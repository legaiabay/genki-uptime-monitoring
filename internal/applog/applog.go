// Package applog provides a ring-buffer log writer that captures all output
// written to the standard logger. Captured entries can be read via Snapshot()
// and broadcast to live subscribers via Subscribe/Unsubscribe.
package applog

import (
	"encoding/json"
	"sync"
	"time"
)

const defaultCap = 500

// Level represents the severity of a log entry.
type Level string

const (
	LevelInfo  Level = "info"
	LevelWarn  Level = "warn"
	LevelError Level = "error"
	LevelDebug Level = "debug"
)

// Entry is a single captured log line.
type Entry struct {
	Timestamp time.Time `json:"timestamp"`
	Level     Level     `json:"level"`
	Message   string    `json:"message"`
}

// Buffer is a thread-safe ring buffer that also fans out to subscribers.
type Buffer struct {
	mu          sync.RWMutex
	entries     []Entry
	cap         int
	head        int // index of the oldest slot
	size        int // how many slots are filled
	subscribers map[chan Entry]struct{}
}

// New creates a Buffer with the default capacity.
func New() *Buffer {
	return NewWithCap(defaultCap)
}

// NewWithCap creates a Buffer with the specified capacity.
func NewWithCap(cap int) *Buffer {
	return &Buffer{
		entries:     make([]Entry, cap),
		cap:         cap,
		subscribers: make(map[chan Entry]struct{}),
	}
}

// Write implements io.Writer. Each call is treated as one log line.
// The method is intentionally lenient: it never returns an error.
func (b *Buffer) Write(p []byte) (n int, err error) {
	msg := string(p)
	// Trim trailing newline that log.Printf appends.
	if len(msg) > 0 && msg[len(msg)-1] == '\n' {
		msg = msg[:len(msg)-1]
	}
	if msg == "" {
		return len(p), nil
	}

	entry := Entry{
		Timestamp: time.Now().UTC(),
		Level:     detectLevel(msg),
		Message:   msg,
	}

	b.mu.Lock()
	idx := (b.head + b.size) % b.cap
	b.entries[idx] = entry
	if b.size < b.cap {
		b.size++
	} else {
		// Buffer is full — advance head, overwriting the oldest entry.
		b.head = (b.head + 1) % b.cap
	}
	subs := make([]chan Entry, 0, len(b.subscribers))
	for ch := range b.subscribers {
		subs = append(subs, ch)
	}
	b.mu.Unlock()

	// Fan-out outside the lock; non-blocking so a slow subscriber never stalls writes.
	for _, ch := range subs {
		select {
		case ch <- entry:
		default:
		}
	}

	return len(p), nil
}

// Snapshot returns a copy of all buffered entries in chronological order.
func (b *Buffer) Snapshot() []Entry {
	b.mu.RLock()
	defer b.mu.RUnlock()

	out := make([]Entry, b.size)
	for i := 0; i < b.size; i++ {
		out[i] = b.entries[(b.head+i)%b.cap]
	}
	return out
}

// Subscribe registers a channel to receive live log entries.
// The caller is responsible for calling Unsubscribe when done.
func (b *Buffer) Subscribe() chan Entry {
	ch := make(chan Entry, 64)
	b.mu.Lock()
	b.subscribers[ch] = struct{}{}
	b.mu.Unlock()
	return ch
}

// Unsubscribe removes a previously registered channel and closes it.
func (b *Buffer) Unsubscribe(ch chan Entry) {
	b.mu.Lock()
	delete(b.subscribers, ch)
	b.mu.Unlock()
	close(ch)
}

// MarshalEntry serialises an Entry to JSON bytes.
func MarshalEntry(e Entry) ([]byte, error) {
	return json.Marshal(e)
}

// detectLevel sniffs common keywords to assign a log level.
func detectLevel(msg string) Level {
	for i := 0; i < len(msg) && i < 20; i++ {
		switch {
		case hasPrefix(msg[i:], "ERR") || hasPrefix(msg[i:], "err") || hasPrefix(msg[i:], "FATAL") || hasPrefix(msg[i:], "fatal"):
			return LevelError
		case hasPrefix(msg[i:], "WARN") || hasPrefix(msg[i:], "warn"):
			return LevelWarn
		case hasPrefix(msg[i:], "DEBUG") || hasPrefix(msg[i:], "debug"):
			return LevelDebug
		}
	}
	return LevelInfo
}

func hasPrefix(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}
