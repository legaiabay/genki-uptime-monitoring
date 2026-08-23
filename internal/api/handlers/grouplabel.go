package handlers

import (
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type GroupLabelHandler struct {
	db *sqlx.DB
}

func NewGroupLabelHandler(db *sqlx.DB) *GroupLabelHandler {
	return &GroupLabelHandler{db: db}
}

// GroupSummary represents a group with its monitor count.
type GroupSummary struct {
	Name         string `db:"group_name" json:"name"`
	MonitorCount int    `db:"monitor_count" json:"monitor_count"`
}

// LabelSummary represents a label with its monitor count.
type LabelSummary struct {
	Name         string `db:"label" json:"name"`
	MonitorCount int    `db:"monitor_count" json:"monitor_count"`
}

// ListGroupsWithCount returns distinct non-empty group names with monitor counts.
func (h *GroupLabelHandler) ListGroupsWithCount(c echo.Context) error {
	var groups []GroupSummary
	err := h.db.SelectContext(c.Request().Context(), &groups,
		`SELECT group_name, COUNT(*) AS monitor_count
		 FROM monitors
		 WHERE group_name <> ''
		 GROUP BY group_name
		 ORDER BY group_name ASC`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch groups")
	}
	if groups == nil {
		groups = []GroupSummary{}
	}
	return c.JSON(http.StatusOK, echo.Map{"data": groups})
}

// ListLabelsWithCount returns distinct labels across all monitors with usage counts.
func (h *GroupLabelHandler) ListLabelsWithCount(c echo.Context) error {
	var labels []LabelSummary
	err := h.db.SelectContext(c.Request().Context(), &labels,
		`SELECT label, COUNT(*) AS monitor_count
		 FROM monitors, UNNEST(labels) AS label
		 WHERE label <> ''
		 GROUP BY label
		 ORDER BY label ASC`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch labels")
	}
	if labels == nil {
		labels = []LabelSummary{}
	}
	return c.JSON(http.StatusOK, echo.Map{"data": labels})
}

type renameGroupRequest struct {
	NewName string `json:"new_name"`
}

// RenameGroup bulk-updates group_name on all monitors with the given group name.
func (h *GroupLabelHandler) RenameGroup(c echo.Context) error {
	oldName := c.Param("name")
	if oldName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "group name is required")
	}

	var req renameGroupRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	req.NewName = strings.TrimSpace(req.NewName)
	if req.NewName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "new_name is required")
	}

	result, err := h.db.ExecContext(c.Request().Context(),
		`UPDATE monitors SET group_name = $1, updated_at = NOW() WHERE group_name = $2`,
		req.NewName, oldName)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to rename group")
	}
	rows, _ := result.RowsAffected()
	return c.JSON(http.StatusOK, echo.Map{"message": "group renamed", "affected": rows})
}

// DeleteGroup clears group_name (sets to ”) on all monitors with the given group name.
func (h *GroupLabelHandler) DeleteGroup(c echo.Context) error {
	name := c.Param("name")
	if name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "group name is required")
	}

	result, err := h.db.ExecContext(c.Request().Context(),
		`UPDATE monitors SET group_name = '', updated_at = NOW() WHERE group_name = $1`,
		name)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete group")
	}
	rows, _ := result.RowsAffected()
	return c.JSON(http.StatusOK, echo.Map{"message": "group deleted", "affected": rows})
}

type renameLabelRequest struct {
	NewName string `json:"new_name"`
}

// RenameLabel replaces a label string across all monitors that use it.
func (h *GroupLabelHandler) RenameLabel(c echo.Context) error {
	oldName := c.Param("name")
	if oldName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "label name is required")
	}

	var req renameLabelRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	req.NewName = strings.TrimSpace(req.NewName)
	if req.NewName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "new_name is required")
	}

	// Replace the old label with the new one in each monitor's labels array.
	// Uses array_remove + array_append to swap cleanly, avoiding duplicates.
	result, err := h.db.ExecContext(c.Request().Context(),
		`UPDATE monitors
		 SET labels = CASE
		   WHEN $2 = ANY(labels) THEN array_remove(labels, $1)
		   ELSE array_append(array_remove(labels, $1), $2)
		 END,
		 updated_at = NOW()
		 WHERE $1 = ANY(labels)`,
		oldName, req.NewName)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to rename label")
	}
	rows, _ := result.RowsAffected()
	return c.JSON(http.StatusOK, echo.Map{"message": "label renamed", "affected": rows})
}

// DeleteLabel removes a label from all monitors that use it.
func (h *GroupLabelHandler) DeleteLabel(c echo.Context) error {
	name := c.Param("name")
	if name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "label name is required")
	}

	result, err := h.db.ExecContext(c.Request().Context(),
		`UPDATE monitors
		 SET labels = array_remove(labels, $1::text), updated_at = NOW()
		 WHERE $1 = ANY(labels)`,
		name)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete label")
	}
	rows, _ := result.RowsAffected()
	return c.JSON(http.StatusOK, echo.Map{"message": "label deleted", "affected": rows})
}
