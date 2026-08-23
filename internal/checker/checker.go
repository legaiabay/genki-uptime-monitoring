package checker

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/models"
)

type Result struct {
	MonitorID    int64
	Status       models.MonitorStatus
	ResponseTime int // milliseconds
	StatusCode   *int
	Message      string
	CheckedAt    time.Time
}

type Checker interface {
	Check(ctx context.Context, monitor *models.Monitor) (*Result, error)
}

// HTTPChecker performs HTTP/HTTPS health checks
type HTTPChecker struct {
	client *http.Client
}

func NewHTTPChecker() *HTTPChecker {
	return &HTTPChecker{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *HTTPChecker) Check(ctx context.Context, monitor *models.Monitor) (*Result, error) {
	start := time.Now()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, monitor.URL, nil)
	if err != nil {
		return &Result{
			MonitorID: monitor.ID,
			Status:    models.MonitorStatusDown,
			Message:   err.Error(),
			CheckedAt: time.Now(),
		}, nil
	}

	resp, err := c.client.Do(req)
	responseTime := int(time.Since(start).Milliseconds())

	if err != nil {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: responseTime,
			Message:      err.Error(),
			CheckedAt:    time.Now(),
		}, nil
	}
	defer resp.Body.Close()

	statusCode := resp.StatusCode
	status := models.MonitorStatusUp

	// Mark as degraded if response time exceeds 2x timeout
	if responseTime > monitor.Timeout*1000*2 {
		status = models.MonitorStatusDegraded
	}

	// Check expected status code
	if monitor.ExpectedStatus > 0 && statusCode != monitor.ExpectedStatus {
		status = models.MonitorStatusDown
	}

	return &Result{
		MonitorID:    monitor.ID,
		Status:       status,
		ResponseTime: responseTime,
		StatusCode:   &statusCode,
		Message:      fmt.Sprintf("%d %s", statusCode, http.StatusText(statusCode)),
		CheckedAt:    time.Now(),
	}, nil
}
