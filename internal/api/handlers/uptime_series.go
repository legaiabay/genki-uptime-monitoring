package handlers

import (
	"net/http"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

// UptimeSeriesHandler returns time-bucketed uptime % per active monitor.
type UptimeSeriesHandler struct {
	db *sqlx.DB
}

func NewUptimeSeriesHandler(db *sqlx.DB) *UptimeSeriesHandler {
	return &UptimeSeriesHandler{db: db}
}

type uptimePoint struct {
	BucketTime time.Time `db:"bucket_time"`
	MonitorID  int64     `db:"monitor_id"`
	MonitorName string   `db:"monitor_name"`
	UptimePct  float64   `db:"uptime_pct"`
}

type UptimeSeriesResponse struct {
	Labels   []string               `json:"labels"`   // X-axis time labels
	Monitors []UptimeMonitorSeries  `json:"monitors"` // one entry per monitor
}

type UptimeMonitorSeries struct {
	ID     int64     `json:"id"`
	Name   string    `json:"name"`
	Color  string    `json:"color"`
	Values []float64 `json:"values"` // parallel to Labels
}

// bucket interval and lookback based on time range query param
func bucketConfig(rangeParam string) (lookback time.Duration, bucketSQL string, labelFormat string) {
	switch rangeParam {
	case "1h":
		return 1 * time.Hour, "date_trunc('minute', checked_at) + (EXTRACT(minute FROM checked_at)::int / 5) * interval '5 minutes'", "15:04"
	case "6h":
		return 6 * time.Hour, "date_trunc('hour', checked_at) + (EXTRACT(minute FROM checked_at)::int / 30) * interval '30 minutes'", "15:04"
	case "7d":
		return 7 * 24 * time.Hour, "date_trunc('hour', checked_at)", "Jan 2 15:00"
	case "30d":
		return 30 * 24 * time.Hour, "date_trunc('day', checked_at)", "Jan 2"
	default: // 24h
		return 24 * time.Hour, "date_trunc('hour', checked_at)", "15:04"
	}
}

var seriesColors = []string{
	"#e53e3e", "#48bb78", "#4299e1", "#ed8936",
	"#9f7aea", "#38b2ac", "#f6ad55", "#fc8181",
}

func (h *UptimeSeriesHandler) GetSeries(c echo.Context) error {
	ctx := c.Request().Context()
	rangeParam := c.QueryParam("range")
	if rangeParam == "" {
		rangeParam = "24h"
	}

	lookback, bucketSQL, labelFormat := bucketConfig(rangeParam)
	since := time.Now().Add(-lookback)

	rows, err := h.db.QueryContext(ctx, `
		SELECT
			`+bucketSQL+` AS bucket_time,
			ml.monitor_id,
			m.name AS monitor_name,
			ROUND(
				COUNT(*) FILTER (WHERE ml.status = 'up')::numeric
				/ NULLIF(COUNT(*), 0) * 100,
			2) AS uptime_pct
		FROM monitor_logs ml
		JOIN monitors m ON m.id = ml.monitor_id
		WHERE ml.checked_at >= $1
		  AND m.active = true
		GROUP BY bucket_time, ml.monitor_id, m.name
		ORDER BY bucket_time ASC, m.name ASC
	`, since)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to query uptime series")
	}
	defer rows.Close()

	// Collect raw points
	type rawPoint struct {
		BucketTime  time.Time
		MonitorID   int64
		MonitorName string
		UptimePct   float64
	}
	var points []rawPoint
	for rows.Next() {
		var p rawPoint
		if err := rows.Scan(&p.BucketTime, &p.MonitorID, &p.MonitorName, &p.UptimePct); err != nil {
			continue
		}
		points = append(points, p)
	}

	// If no data at all, return empty response
	if len(points) == 0 {
		return c.JSON(http.StatusOK, UptimeSeriesResponse{
			Labels:   []string{},
			Monitors: []UptimeMonitorSeries{},
		})
	}

	// Build ordered unique label list and monitor map
	labelSet := make(map[string]int) // label -> index
	var labels []string
	type monitorMeta struct {
		ID   int64
		Name string
	}
	monitorOrder := []monitorMeta{}
	monitorSet := make(map[int64]bool)

	for _, p := range points {
		lbl := p.BucketTime.Local().Format(labelFormat)
		if _, ok := labelSet[lbl]; !ok {
			labelSet[lbl] = len(labels)
			labels = append(labels, lbl)
		}
		if !monitorSet[p.MonitorID] {
			monitorSet[p.MonitorID] = true
			monitorOrder = append(monitorOrder, monitorMeta{ID: p.MonitorID, Name: p.MonitorName})
		}
	}

	// Fill values matrix (monitors × labels), default 100 where no data
	valueMap := make(map[int64]map[string]float64)
	for _, p := range points {
		if valueMap[p.MonitorID] == nil {
			valueMap[p.MonitorID] = make(map[string]float64)
		}
		lbl := p.BucketTime.Local().Format(labelFormat)
		valueMap[p.MonitorID][lbl] = p.UptimePct
	}

	result := make([]UptimeMonitorSeries, 0, len(monitorOrder))
	for i, mon := range monitorOrder {
		values := make([]float64, len(labels))
		for j, lbl := range labels {
			if v, ok := valueMap[mon.ID][lbl]; ok {
				values[j] = v
			} else {
				values[j] = 100 // assume up if no data in bucket
			}
		}
		color := seriesColors[i%len(seriesColors)]
		result = append(result, UptimeMonitorSeries{
			ID:     mon.ID,
			Name:   mon.Name,
			Color:  color,
			Values: values,
		})
	}

	return c.JSON(http.StatusOK, UptimeSeriesResponse{
		Labels:   labels,
		Monitors: result,
	})
}
