// Package crypto provides AES-256-GCM encryption helpers for storing sensitive
// monitor fields (e.g. database connection strings) at rest.
//
// Key format: 32 bytes encoded as a 64-character lowercase hex string.
// Generate a key: openssl rand -hex 32
//
// Ciphertext format: nonce (12 bytes) || ciphertext, hex-encoded.
// The hex encoding makes the value safe to store in a TEXT column and include
// in logs without binary surprises.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
)

var (
	ErrNoKey         = errors.New("DB_ENCRYPTION_KEY is not configured")
	ErrInvalidKey    = errors.New("invalid encryption key: must be 64 hex characters (32 bytes)")
	ErrInvalidCipher = errors.New("invalid ciphertext: too short")
)

// Encrypt encrypts plaintext with AES-256-GCM using the provided hex-encoded
// 32-byte key. Returns hex-encoded nonce||ciphertext.
// Returns ErrNoKey when key is empty (caller should treat as "store plaintext
// with a warning" or return an error — the handler decides).
func Encrypt(hexKey, plaintext string) (string, error) {
	if hexKey == "" {
		return "", ErrNoKey
	}

	key, err := decodeKey(hexKey)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("crypto: create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("crypto: create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize()) // 12 bytes
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("crypto: generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return hex.EncodeToString(ciphertext), nil
}

// Decrypt decrypts a hex-encoded nonce||ciphertext produced by Encrypt.
// Returns ErrNoKey when key is empty.
func Decrypt(hexKey, hexCiphertext string) (string, error) {
	if hexKey == "" {
		return "", ErrNoKey
	}

	key, err := decodeKey(hexKey)
	if err != nil {
		return "", err
	}

	data, err := hex.DecodeString(hexCiphertext)
	if err != nil {
		return "", fmt.Errorf("crypto: decode ciphertext hex: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("crypto: create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("crypto: create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", ErrInvalidCipher
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("crypto: decrypt: %w", err)
	}

	return string(plaintext), nil
}

// IsEncrypted returns true when s looks like a hex-encoded ciphertext produced
// by Encrypt (all hex chars, length >= 24 bytes for nonce + 1 byte + 16 byte
// GCM tag = 58 hex chars minimum). Used by the checker to skip re-encrypting
// a value that is already encrypted.
func IsEncrypted(s string) bool {
	if len(s) < 58 {
		return false
	}
	_, err := hex.DecodeString(s)
	return err == nil
}

func decodeKey(hexKey string) ([]byte, error) {
	key, err := hex.DecodeString(hexKey)
	if err != nil || len(key) != 32 {
		return nil, ErrInvalidKey
	}
	return key, nil
}
