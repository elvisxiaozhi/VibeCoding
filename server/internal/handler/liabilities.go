package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/theodore/vibecoding-server/internal/middleware"
	"github.com/theodore/vibecoding-server/internal/model"
	"github.com/theodore/vibecoding-server/internal/store"
)

type Liabilities struct {
	Store *store.Store
}

func (h *Liabilities) RegisterRoutes(mux *http.ServeMux) {
	authMw := middleware.Auth(h.Store)
	mux.Handle("GET /api/liabilities", authMw(http.HandlerFunc(h.list)))
	mux.Handle("GET /api/liabilities/{id}", authMw(http.HandlerFunc(h.get)))
	mux.Handle("POST /api/liabilities", authMw(http.HandlerFunc(h.create)))
	mux.Handle("PUT /api/liabilities/{id}", authMw(http.HandlerFunc(h.update)))
	mux.Handle("DELETE /api/liabilities/{id}", authMw(http.HandlerFunc(h.remove)))
}

type liabilityRequest struct {
	Name         string  `json:"name"`
	Category     string  `json:"category"`
	Principal    float64 `json:"principal"`
	Currency     string  `json:"currency"`
	InterestRate float64 `json:"interestRate"`
	DueDate      string  `json:"dueDate"`
	Owner        string  `json:"owner"`
	Note         string  `json:"note"`
}

func (h *Liabilities) list(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	owner := r.URL.Query().Get("owner")
	liabilities, err := h.Store.ListLiabilities(userID, owner)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if liabilities == nil {
		liabilities = []model.Liability{}
	}
	writeJSON(w, http.StatusOK, liabilities)
}

func (h *Liabilities) get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := middleware.UserIDFromContext(r.Context())
	liability, err := h.Store.GetLiability(id, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "liability not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, liability)
}

func (h *Liabilities) create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	var req liabilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := validateLiability(req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	liability := model.Liability{
		ID:           uuid.NewString(),
		UserID:       userID,
		Name:         req.Name,
		Category:     req.Category,
		Principal:    req.Principal,
		Currency:     req.Currency,
		InterestRate: req.InterestRate,
		DueDate:      req.DueDate,
		Owner:        req.Owner,
		Note:         req.Note,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	applyLiabilityDefaults(&liability)
	if err := h.Store.CreateLiability(liability); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, liability)
}

func (h *Liabilities) update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := middleware.UserIDFromContext(r.Context())
	existing, err := h.Store.GetLiability(id, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "liability not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var req liabilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := validateLiability(req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	liability := model.Liability{
		ID:           id,
		UserID:       userID,
		Name:         req.Name,
		Category:     req.Category,
		Principal:    req.Principal,
		Currency:     req.Currency,
		InterestRate: req.InterestRate,
		DueDate:      req.DueDate,
		Owner:        req.Owner,
		Note:         req.Note,
		CreatedAt:    existing.CreatedAt,
		UpdatedAt:    time.Now().UTC().Format(time.RFC3339Nano),
	}
	applyLiabilityDefaults(&liability)
	if err := h.Store.UpdateLiability(liability); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, liability)
}

func (h *Liabilities) remove(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := middleware.UserIDFromContext(r.Context())
	if err := h.Store.DeleteLiability(id, userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "liability not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"deleted": id})
}

func validateLiability(req liabilityRequest) error {
	if req.Name == "" {
		return errors.New("name is required")
	}
	switch req.Category {
	case model.LiabilityMortgage, model.LiabilityCreditCard, model.LiabilityLoan, model.LiabilityOther:
	default:
		return errors.New("category must be one of: mortgage, credit_card, loan, other")
	}
	if req.Principal < 0 {
		return errors.New("principal must be greater than or equal to 0")
	}
	if req.InterestRate < 0 {
		return errors.New("interestRate must be greater than or equal to 0")
	}
	return nil
}

func applyLiabilityDefaults(liability *model.Liability) {
	if liability.Currency == "" {
		liability.Currency = "CNY"
	}
	if liability.Owner == "" {
		liability.Owner = "me"
	}
}
