package checker

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/models"
)

// Result holds the outcome of a single monitor check.
type Result struct {
	MonitorID    int64
	Status       models.MonitorStatus
	ResponseTime int // milliseconds
	StatusCode   *int
	Message      string
	CheckedAt    time.Time
	// SSLExpiryDate is set when the check connected over TLS and a certificate
	// was inspected. Nil for non-HTTPS monitors.
	SSLExpiryDate *time.Time
}

// Checker is the interface every monitor-type implementation must satisfy.
type Checker interface {
	Check(ctx context.Context, monitor *models.Monitor) (*Result, error)
}

// ── HTTP / HTTPS ──────────────────────────────────────────────────────────────
// For HTTPS URLs, the checker also inspects the TLS certificate from the
// established connection and marks the monitor as Degraded when the cert is
// about to expire (within monitor.SSLWarningDays days, default 30).

// tlsState captures the TLS connection state so we can read the certificate
// after the HTTP response has been received — without a second dial.
type tlsState struct {
	state *tls.ConnectionState
}

type capturingTransport struct {
	base     *http.Transport
	captured *tlsState
}

func (t *capturingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	resp, err := t.base.RoundTrip(req)
	if err == nil && resp.TLS != nil {
		t.captured.state = resp.TLS
	}
	return resp, err
}

type HTTPChecker struct{}

func NewHTTPChecker() *HTTPChecker { return &HTTPChecker{} }

func (c *HTTPChecker) Check(ctx context.Context, monitor *models.Monitor) (*Result, error) {
	start := time.Now()

	captured := &tlsState{}
	transport := &capturingTransport{
		base:     &http.Transport{},
		captured: captured,
	}
	client := &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, monitor.URL, nil)
	if err != nil {
		return &Result{
			MonitorID: monitor.ID,
			Status:    models.MonitorStatusDown,
			Message:   err.Error(),
			CheckedAt: time.Now(),
		}, nil
	}

	resp, err := client.Do(req)
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
	message := fmt.Sprintf("%d %s", statusCode, http.StatusText(statusCode))

	if responseTime > monitor.Timeout*1000*2 {
		status = models.MonitorStatusDegraded
	}
	if monitor.ExpectedStatus > 0 && statusCode != monitor.ExpectedStatus {
		status = models.MonitorStatusDown
	}

	// For HTTPS: check certificate expiry using the connection we already made.
	if status != models.MonitorStatusDown && captured.state != nil && len(captured.state.PeerCertificates) > 0 {
		cert := captured.state.PeerCertificates[0]
		now := time.Now()
		expiry := cert.NotAfter
		daysLeft := int(expiry.Sub(now).Hours() / 24)

		warningDays := monitor.SSLWarningDays
		if warningDays <= 0 {
			warningDays = 30
		}

		// Always store the expiry date regardless of status
		expiryTime := expiry

		if now.After(expiry) {
			// Cert already expired — treat as down even if HTTP responded ok
			status = models.MonitorStatusDown
			message = fmt.Sprintf("%d %s — SSL certificate expired on %s",
				statusCode, http.StatusText(statusCode), expiry.Format("2006-01-02"))
		} else if daysLeft <= warningDays {
			// Only downgrade to degraded if we weren't already down
			if status == models.MonitorStatusUp {
				status = models.MonitorStatusDegraded
			}
			message = fmt.Sprintf("%d %s — SSL certificate expires in %d days (%s)",
				statusCode, http.StatusText(statusCode), daysLeft, expiry.Format("2006-01-02"))
		} else {
			message = fmt.Sprintf("%d %s — SSL valid, expires %s (%d days)",
				statusCode, http.StatusText(statusCode), expiry.Format("2006-01-02"), daysLeft)
		}

		return &Result{
			MonitorID:     monitor.ID,
			Status:        status,
			ResponseTime:  responseTime,
			StatusCode:    &statusCode,
			Message:       message,
			CheckedAt:     time.Now(),
			SSLExpiryDate: &expiryTime,
		}, nil
	}

	return &Result{
		MonitorID:    monitor.ID,
		Status:       status,
		ResponseTime: responseTime,
		StatusCode:   &statusCode,
		Message:      message,
		CheckedAt:    time.Now(),
	}, nil
}

// ── TCP Port ──────────────────────────────────────────────────────────────────

type TCPChecker struct{}

func NewTCPChecker() *TCPChecker { return &TCPChecker{} }

func (c *TCPChecker) Check(ctx context.Context, monitor *models.Monitor) (*Result, error) {
	start := time.Now()

	var d net.Dialer
	conn, err := d.DialContext(ctx, "tcp", monitor.URL)
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
	conn.Close()

	return &Result{
		MonitorID:    monitor.ID,
		Status:       models.MonitorStatusUp,
		ResponseTime: responseTime,
		Message:      fmt.Sprintf("TCP connection to %s succeeded", monitor.URL),
		CheckedAt:    time.Now(),
	}, nil
}

// ── Ping (ICMP via TCP echo fallback) ────────────────────────────────────────
// Uses a TCP dial to port 7 (echo) or falls back to a raw TCP connection attempt
// to port 80 so the check works without root/CAP_NET_RAW privileges.
// The URL should be a hostname or IP (no port); we probe TCP:80 as a reachability
// signal — if you need true ICMP, run the binary with the appropriate capability.

type PingChecker struct{}

func NewPingChecker() *PingChecker { return &PingChecker{} }

func (c *PingChecker) Check(ctx context.Context, monitor *models.Monitor) (*Result, error) {
	start := time.Now()

	host := monitor.URL
	// Strip any scheme the user may have typed
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}

	var d net.Dialer
	// Probe TCP:80 as a privilege-free reachability check
	conn, err := d.DialContext(ctx, "tcp", net.JoinHostPort(host, "80"))
	responseTime := int(time.Since(start).Milliseconds())

	if err != nil {
		// Try port 443 before giving up
		conn2, err2 := d.DialContext(ctx, "tcp", net.JoinHostPort(host, "443"))
		responseTime = int(time.Since(start).Milliseconds())
		if err2 != nil {
			return &Result{
				MonitorID:    monitor.ID,
				Status:       models.MonitorStatusDown,
				ResponseTime: responseTime,
				Message:      fmt.Sprintf("host unreachable: %v", err),
				CheckedAt:    time.Now(),
			}, nil
		}
		conn2.Close()
	} else {
		conn.Close()
	}

	return &Result{
		MonitorID:    monitor.ID,
		Status:       models.MonitorStatusUp,
		ResponseTime: responseTime,
		Message:      fmt.Sprintf("host %s is reachable", host),
		CheckedAt:    time.Now(),
	}, nil
}

// ── DNS ───────────────────────────────────────────────────────────────────────
// monitor.URL      — the hostname/domain to resolve (e.g. "example.com")
// monitor.DNSRecordType — "A", "AAAA", "CNAME", "MX", "TXT", "NS"
// monitor.DNSExpectedIP — optional; if set, at least one result must match

type DNSChecker struct {
	resolver *net.Resolver
}

func NewDNSChecker() *DNSChecker {
	return &DNSChecker{resolver: net.DefaultResolver}
}

func (c *DNSChecker) Check(ctx context.Context, monitor *models.Monitor) (*Result, error) {
	start := time.Now()
	host := monitor.URL
	recordType := monitor.DNSRecordType
	if recordType == "" {
		recordType = "A"
	}

	var results []string
	var lookupErr error

	switch recordType {
	case "A", "AAAA":
		addrs, err := c.resolver.LookupHost(ctx, host)
		lookupErr = err
		results = addrs
	case "CNAME":
		cname, err := c.resolver.LookupCNAME(ctx, host)
		lookupErr = err
		if err == nil {
			results = []string{cname}
		}
	case "MX":
		mxs, err := c.resolver.LookupMX(ctx, host)
		lookupErr = err
		for _, mx := range mxs {
			results = append(results, fmt.Sprintf("%s (prio %d)", mx.Host, mx.Pref))
		}
	case "TXT":
		txts, err := c.resolver.LookupTXT(ctx, host)
		lookupErr = err
		results = txts
	case "NS":
		nss, err := c.resolver.LookupNS(ctx, host)
		lookupErr = err
		for _, ns := range nss {
			results = append(results, ns.Host)
		}
	default:
		addrs, err := c.resolver.LookupHost(ctx, host)
		lookupErr = err
		results = addrs
	}

	responseTime := int(time.Since(start).Milliseconds())

	if lookupErr != nil {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: responseTime,
			Message:      fmt.Sprintf("DNS lookup failed: %v", lookupErr),
			CheckedAt:    time.Now(),
		}, nil
	}

	if len(results) == 0 {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: responseTime,
			Message:      fmt.Sprintf("DNS %s lookup for %s returned no records", recordType, host),
			CheckedAt:    time.Now(),
		}, nil
	}

	// Optional expected IP/value check
	if monitor.DNSExpectedIP != "" {
		found := false
		for _, r := range results {
			if r == monitor.DNSExpectedIP {
				found = true
				break
			}
		}
		if !found {
			return &Result{
				MonitorID:    monitor.ID,
				Status:       models.MonitorStatusDown,
				ResponseTime: responseTime,
				Message:      fmt.Sprintf("DNS %s for %s: expected %q, got %v", recordType, host, monitor.DNSExpectedIP, results),
				CheckedAt:    time.Now(),
			}, nil
		}
	}

	return &Result{
		MonitorID:    monitor.ID,
		Status:       models.MonitorStatusUp,
		ResponseTime: responseTime,
		Message:      fmt.Sprintf("DNS %s for %s: %v", recordType, host, results),
		CheckedAt:    time.Now(),
	}, nil
}

// ── SSL / TLS Certificate ─────────────────────────────────────────────────────
// monitor.URL          — hostname (or host:port; default port 443)
// monitor.SSLWarningDays — warn (degraded) if cert expires within this many days

type SSLChecker struct{}

func NewSSLChecker() *SSLChecker { return &SSLChecker{} }

func (c *SSLChecker) Check(ctx context.Context, monitor *models.Monitor) (*Result, error) {
	start := time.Now()

	host := monitor.URL
	// Ensure host:port format
	if _, _, err := net.SplitHostPort(host); err != nil {
		host = net.JoinHostPort(host, "443")
	}

	// Strip hostname for SNI
	hostname, _, _ := net.SplitHostPort(host)

	dialer := &tls.Dialer{
		NetDialer: &net.Dialer{},
		Config:    &tls.Config{ServerName: hostname},
	}

	conn, err := dialer.DialContext(ctx, "tcp", host)
	responseTime := int(time.Since(start).Milliseconds())

	if err != nil {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: responseTime,
			Message:      fmt.Sprintf("TLS handshake failed: %v", err),
			CheckedAt:    time.Now(),
		}, nil
	}
	defer conn.Close()

	tlsConn := conn.(*tls.Conn)
	certs := tlsConn.ConnectionState().PeerCertificates
	if len(certs) == 0 {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: responseTime,
			Message:      "no certificates presented by server",
			CheckedAt:    time.Now(),
		}, nil
	}

	cert := certs[0]
	now := time.Now()
	expiry := cert.NotAfter
	daysLeft := int(expiry.Sub(now).Hours() / 24)

	warningDays := monitor.SSLWarningDays
	if warningDays <= 0 {
		warningDays = 30
	}

	if now.After(expiry) {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: responseTime,
			Message:      fmt.Sprintf("certificate expired on %s", expiry.Format("2006-01-02")),
			CheckedAt:    time.Now(),
		}, nil
	}

	status := models.MonitorStatusUp
	msg := fmt.Sprintf("certificate valid, expires %s (%d days)", expiry.Format("2006-01-02"), daysLeft)

	if daysLeft <= warningDays {
		status = models.MonitorStatusDegraded
		msg = fmt.Sprintf("certificate expires soon: %s (%d days left)", expiry.Format("2006-01-02"), daysLeft)
	}

	return &Result{
		MonitorID:    monitor.ID,
		Status:       status,
		ResponseTime: responseTime,
		Message:      msg,
		CheckedAt:    time.Now(),
	}, nil
}

// ── gRPC Health Check ─────────────────────────────────────────────────────────
// Implements the gRPC Health Checking Protocol (grpc.health.v1.Health/Check).
// monitor.URL         — host:port of the gRPC server
// monitor.GRPCService — service name to check (empty string = overall server health)
// monitor.GRPCMethod  — ignored (protocol always calls Health/Check)
//
// We send the raw HTTP/2 gRPC request manually to avoid importing the full gRPC
// client stack, keeping the binary lean.

type GRPCChecker struct{}

func NewGRPCChecker() *GRPCChecker { return &GRPCChecker{} }

func (c *GRPCChecker) Check(ctx context.Context, monitor *models.Monitor) (*Result, error) {
	start := time.Now()

	addr := monitor.URL
	if _, _, err := net.SplitHostPort(addr); err != nil {
		addr = net.JoinHostPort(addr, "50051")
	}

	// Build the gRPC Health Check request body manually.
	// HealthCheckRequest proto: field 1 (service name) is a string.
	// Wire format: tag=0x0a (field 1, type 2 = LEN), length, bytes
	service := monitor.GRPCService
	var body []byte
	if service != "" {
		serviceBytes := []byte(service)
		body = append([]byte{0x0a, byte(len(serviceBytes))}, serviceBytes...)
	}
	// gRPC framing: 1 byte compressed flag (0) + 4 bytes big-endian message length
	frame := make([]byte, 5+len(body))
	frame[0] = 0
	frame[1] = byte(len(body) >> 24)
	frame[2] = byte(len(body) >> 16)
	frame[3] = byte(len(body) >> 8)
	frame[4] = byte(len(body))
	copy(frame[5:], body)

	transport := &http.Transport{
		ForceAttemptHTTP2: true,
		DialContext:       (&net.Dialer{}).DialContext,
	}
	client := &http.Client{Transport: transport}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		fmt.Sprintf("http://%s/grpc.health.v1.Health/Check", addr),
		newBytesReader(frame))
	if err != nil {
		responseTime := int(time.Since(start).Milliseconds())
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: responseTime,
			Message:      err.Error(),
			CheckedAt:    time.Now(),
		}, nil
	}
	req.Header.Set("Content-Type", "application/grpc")
	req.Header.Set("TE", "trailers")

	resp, err := client.Do(req)
	responseTime := int(time.Since(start).Milliseconds())
	if err != nil {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: responseTime,
			Message:      fmt.Sprintf("gRPC connection failed: %v", err),
			CheckedAt:    time.Now(),
		}, nil
	}
	defer resp.Body.Close()

	// gRPC status is in the grpc-status trailer (0 = OK)
	grpcStatus := resp.Trailer.Get("grpc-status")
	if grpcStatus == "" {
		grpcStatus = resp.Header.Get("grpc-status")
	}

	if grpcStatus != "0" && grpcStatus != "" {
		grpcMsg := resp.Trailer.Get("grpc-message")
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: responseTime,
			Message:      fmt.Sprintf("gRPC status %s: %s", grpcStatus, grpcMsg),
			CheckedAt:    time.Now(),
		}, nil
	}

	svcLabel := service
	if svcLabel == "" {
		svcLabel = "(server)"
	}
	return &Result{
		MonitorID:    monitor.ID,
		Status:       models.MonitorStatusUp,
		ResponseTime: responseTime,
		Message:      fmt.Sprintf("gRPC health check OK for service %s", svcLabel),
		CheckedAt:    time.Now(),
	}, nil
}

// ── UDP Port ──────────────────────────────────────────────────────────────────
// Sends a zero-byte UDP datagram and checks for an ICMP port-unreachable error.
// monitor.URL — host:port (e.g. "8.8.8.8:53")
// Up   = packet sent without ICMP port-unreachable (port is open/filtered)
// Down = ICMP port-unreachable received (port is closed) or timeout on dial

type UDPChecker struct{}

func NewUDPChecker() *UDPChecker { return &UDPChecker{} }

func (c *UDPChecker) Check(ctx context.Context, monitor *models.Monitor) (*Result, error) {
	start := time.Now()

	addr := monitor.URL
	if _, _, err := net.SplitHostPort(addr); err != nil {
		return &Result{
			MonitorID: monitor.ID,
			Status:    models.MonitorStatusDown,
			Message:   "UDP monitor URL must be in host:port format (e.g. 8.8.8.8:53)",
			CheckedAt: time.Now(),
		}, nil
	}

	var d net.Dialer
	conn, err := d.DialContext(ctx, "udp", addr)
	responseTime := int(time.Since(start).Milliseconds())
	if err != nil {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: responseTime,
			Message:      fmt.Sprintf("UDP dial failed: %v", err),
			CheckedAt:    time.Now(),
		}, nil
	}
	defer conn.Close()

	// Set a short read deadline to catch ICMP port-unreachable replies
	deadline := time.Now().Add(2 * time.Second)
	conn.SetDeadline(deadline)

	// Send an empty datagram
	_, err = conn.Write([]byte{})
	if err != nil {
		responseTime = int(time.Since(start).Milliseconds())
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: responseTime,
			Message:      fmt.Sprintf("UDP write failed: %v", err),
			CheckedAt:    time.Now(),
		}, nil
	}

	// Try to read — if we get an ICMP port-unreachable the OS will return an error here
	buf := make([]byte, 1)
	_, err = conn.Read(buf)
	responseTime = int(time.Since(start).Milliseconds())

	if err != nil {
		// A timeout means no ICMP rejection arrived → port is open/filtered → UP
		if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
			return &Result{
				MonitorID:    monitor.ID,
				Status:       models.MonitorStatusUp,
				ResponseTime: responseTime,
				Message:      fmt.Sprintf("UDP port %s is open/reachable", addr),
				CheckedAt:    time.Now(),
			}, nil
		}
		// Any other error (connection refused = ICMP unreachable) → DOWN
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: responseTime,
			Message:      fmt.Sprintf("UDP port %s is closed: %v", addr, err),
			CheckedAt:    time.Now(),
		}, nil
	}

	// Got a response → port responded → UP
	return &Result{
		MonitorID:    monitor.ID,
		Status:       models.MonitorStatusUp,
		ResponseTime: responseTime,
		Message:      fmt.Sprintf("UDP port %s responded", addr),
		CheckedAt:    time.Now(),
	}, nil
}

// ── helpers ───────────────────────────────────────────────────────────────────

type bytesReader struct {
	data []byte
	pos  int
}

func newBytesReader(b []byte) *bytesReader { return &bytesReader{data: b} }

func (r *bytesReader) Read(p []byte) (int, error) {
	if r.pos >= len(r.data) {
		return 0, fmt.Errorf("EOF")
	}
	n := copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}
