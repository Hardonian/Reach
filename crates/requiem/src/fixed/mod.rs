//! Fixed-Point Math Module
//!
//! Provides deterministic numeric representations for values where float variance
//! can occur across platforms or compiler versions.
//!
//! # Design Principles
//! - All types are POD (Plain Old Data) - no heap allocations
//! - Operations are overflow-checked and deterministic
//! - Serialization uses little-endian byte order
//! - No floating-point in protocol fields (allowed only in UI pretty-print)

use serde::{Deserialize, Serialize};
use std::fmt;
use std::ops::{Add, Div, Mul, Sub};

/// Fixed-point Q32.32 format (signed 64-bit)
/// Range: ~-2.1 billion to +2.1 billion
/// Precision: ~2.3e-10
///
/// Used for: rates, throughput, ratios requiring high precision
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct FixedQ32_32(i64);

impl FixedQ32_32 {
    /// Number of fractional bits
    const FRACTIONAL_BITS: u32 = 32;
    /// Scaling factor as f64 for conversions
    const SCALE_F64: f64 = (1u64 << 32) as f64;
    /// Scaling factor as i64 for arithmetic
    const SCALE: i64 = 1i64 << 32;

    /// Create from raw i64 bits (for deserialization)
    pub const fn from_raw(raw: i64) -> Self {
        Self(raw)
    }

    /// Get raw i64 bits (for serialization)
    pub const fn to_raw(self) -> i64 {
        self.0
    }

    /// Create from f64 value (for construction only, not in hot paths)
    /// 
    /// # Panics
    /// Panics in debug mode if value is out of range
    pub fn from_f64(value: f64) -> Option<Self> {
        if value.is_nan() || value.is_infinite() {
            return None;
        }
        let scaled = value * Self::SCALE_F64;
        if scaled > i64::MAX as f64 || scaled < i64::MIN as f64 {
            return None;
        }
        Some(Self(scaled as i64))
    }

    /// Convert to f64 (for UI display only, not in digest path)
    pub fn to_f64(self) -> f64 {
        self.0 as f64 / Self::SCALE_F64
    }

    /// Create from integer
    pub const fn from_i64(value: i64) -> Option<Self> {
        // Check for overflow before shifting
        if value > (i64::MAX >> Self::FRACTIONAL_BITS) 
            || value < (i64::MIN >> Self::FRACTIONAL_BITS) {
            return None;
        }
        Some(Self(value << Self::FRACTIONAL_BITS))
    }

    /// Zero constant
    pub const ZERO: Self = Self(0);
    /// One constant
    pub const ONE: Self = Self(1i64 << 32);

    /// Checked addition
    pub fn checked_add(self, rhs: Self) -> Option<Self> {
        self.0.checked_add(rhs.0).map(Self)
    }

    /// Checked subtraction
    pub fn checked_sub(self, rhs: Self) -> Option<Self> {
        self.0.checked_sub(rhs.0).map(Self)
    }

    /// Checked multiplication
    /// Uses 128-bit intermediate to prevent overflow
    pub fn checked_mul(self, rhs: Self) -> Option<Self> {
        let a = self.0 as i128;
        let b = rhs.0 as i128;
        let product = (a * b) >> Self::FRACTIONAL_BITS;
        if product > i64::MAX as i128 || product < i64::MIN as i128 {
            return None;
        }
        Some(Self(product as i64))
    }

    /// Checked division
    /// Uses 128-bit intermediate for precision
    pub fn checked_div(self, rhs: Self) -> Option<Self> {
        if rhs.0 == 0 {
            return None;
        }
        let a = (self.0 as i128) << Self::FRACTIONAL_BITS;
        let b = rhs.0 as i128;
        let quotient = a / b;
        if quotient > i64::MAX as i128 || quotient < i64::MIN as i128 {
            return None;
        }
        Some(Self(quotient as i64))
    }

    /// Saturating addition (deterministic overflow handling)
    pub fn saturating_add(self, rhs: Self) -> Self {
        Self(self.0.saturating_add(rhs.0))
    }

    /// Saturating multiplication
    pub fn saturating_mul(self, rhs: Self) -> Self {
        match self.checked_mul(rhs) {
            Some(v) => v,
            None => {
                let sign = (self.0 < 0) ^ (rhs.0 < 0);
                if sign {
                    Self(i64::MIN)  // Negative overflow
                } else {
                    Self(i64::MAX)  // Positive overflow
                }
            }
        }
    }
}

impl fmt::Display for FixedQ32_32 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:.10}", self.to_f64())
    }
}

/// Basis points (1/100 of 1 percent)
/// Range: -327.68% to +327.67%
/// Used for: percentages in protocol fields
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct FixedBps(i16);

impl FixedBps {
    /// One basis point = 0.01%
    pub const ONE: Self = Self(1);
    /// 100 basis points = 1%
    pub const PERCENT: Self = Self(100);
    /// 10000 basis points = 100%
    pub const ONE_HUNDRED_PERCENT: Self = Self(10000);
    /// Zero
    pub const ZERO: Self = Self(0);

    /// Create from basis points value
    pub const fn from_bps(bps: i16) -> Self {
        Self(bps)
    }

    /// Create from percentage (e.g., 5.5 -> 550 bps)
    pub fn from_percent(percent: f64) -> Option<Self> {
        let bps = (percent * 100.0).round() as i32;
        if bps > i16::MAX as i32 || bps < i16::MIN as i32 {
            return None;
        }
        Some(Self(bps as i16))
    }

    /// Convert to percentage as f64 (UI only)
    pub fn to_percent(self) -> f64 {
        self.0 as f64 / 100.0
    }

    /// Get raw value
    pub const fn to_raw(self) -> i16 {
        self.0
    }

    /// Create from raw (deserialization)
    pub const fn from_raw(raw: i16) -> Self {
        Self(raw)
    }
}

impl fmt::Display for FixedBps {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} bps ({:.2}%)", self.0, self.to_percent())
    }
}

/// Parts per million (ppm)
/// Range: -2,147,483 to +2,147,483 ppm (~ -214% to +214%)
/// Used for: hit rates, probabilities requiring higher precision than bps
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct FixedPpm(i32);

impl FixedPpm {
    /// One part per million
    pub const ONE: Self = Self(1);
    /// One percent = 10,000 ppm
    pub const PERCENT: Self = Self(10_000);
    /// 100 percent = 1,000,000 ppm
    pub const ONE_HUNDRED_PERCENT: Self = Self(1_000_000);
    /// Zero
    pub const ZERO: Self = Self(0);

    /// Create from ppm value
    pub const fn from_ppm(ppm: i32) -> Self {
        Self(ppm)
    }

    /// Create from ratio [0, 1] -> [0, 1_000_000]
    pub fn from_ratio(ratio: f64) -> Option<Self> {
        if ratio < 0.0 || ratio > 1.0 {
            return None;
        }
        let ppm = (ratio * 1_000_000.0).round() as i64;
        if ppm > i32::MAX as i64 {
            return None;
        }
        Some(Self(ppm as i32))
    }

    /// Convert to ratio as f64 (UI only)
    pub fn to_ratio(self) -> f64 {
        self.0 as f64 / 1_000_000.0
    }

    /// Get raw value
    pub const fn to_raw(self) -> i32 {
        self.0
    }

    /// Create from raw (deserialization)
    pub const fn from_raw(raw: i32) -> Self {
        Self(raw)
    }

    /// Checked addition
    pub fn checked_add(self, rhs: Self) -> Option<Self> {
        self.0.checked_add(rhs.0).map(Self)
    }

    /// Saturating addition
    pub fn saturating_add(self, rhs: Self) -> Self {
        Self(self.0.saturating_add(rhs.0))
    }
}

impl fmt::Display for FixedPpm {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} ppm ({:.4}%)", self.0, self.to_ratio() * 100.0)
    }
}

/// Duration in microseconds
/// Used for: timeouts, histogram bucket boundaries, latency measurements
/// 
/// This is i64 to allow for negative durations (useful for relative time)
/// Range: +/- 292,471 years (sufficient for all practical purposes)
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct FixedDuration(i64);

impl FixedDuration {
    /// Zero duration
    pub const ZERO: Self = Self(0);
    /// One microsecond
    pub const ONE_MICROSECOND: Self = Self(1);
    /// One millisecond = 1000 microseconds
    pub const ONE_MILLISECOND: Self = Self(1000);
    /// One second = 1,000,000 microseconds
    pub const ONE_SECOND: Self = Self(1_000_000);
    /// One minute
    pub const ONE_MINUTE: Self = Self(60_000_000);

    /// Create from microseconds
    pub const fn from_micros(micros: i64) -> Self {
        Self(micros)
    }

    /// Create from milliseconds
    pub const fn from_millis(millis: i64) -> Option<Self> {
        millis.checked_mul(1000).map(Self)
    }

    /// Create from seconds
    pub const fn from_seconds(seconds: i64) -> Option<Self> {
        seconds.checked_mul(1_000_000).map(Self)
    }

    /// Convert to microseconds
    pub const fn to_micros(self) -> i64 {
        self.0
    }

    /// Convert to milliseconds (truncates)
    pub const fn to_millis(self) -> i64 {
        self.0 / 1000
    }

    /// Convert to seconds (truncates)
    pub const fn to_seconds(self) -> i64 {
        self.0 / 1_000_000
    }

    /// Get raw value
    pub const fn to_raw(self) -> i64 {
        self.0
    }

    /// Create from raw (deserialization)
    pub const fn from_raw(raw: i64) -> Self {
        Self(raw)
    }

    /// Checked addition
    pub fn checked_add(self, rhs: Self) -> Option<Self> {
        self.0.checked_add(rhs.0).map(Self)
    }

    /// Checked subtraction
    pub fn checked_sub(self, rhs: Self) -> Option<Self> {
        self.0.checked_sub(rhs.0).map(Self)
    }
}

impl fmt::Display for FixedDuration {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let micros = self.0.abs();
        let sign = if self.0 < 0 { "-" } else { "" };
        
        if micros >= 1_000_000 {
            write!(f, "{}{}.{:06}s", sign, micros / 1_000_000, micros % 1_000_000)
        } else if micros >= 1000 {
            write!(f, "{}{}.{:03}ms", sign, micros / 1000, micros % 1000)
        } else {
            write!(f, "{}{}µs", sign, micros)
        }
    }
}

/// Throughput in micro-operations per second
/// Used for: ops/sec rates with 6 decimal precision
/// 
/// Example: 1,000,000 = 1 op/sec, 2,500,000 = 2.5 ops/sec
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct FixedThroughput(i64);

impl FixedThroughput {
    /// Scale factor: 1,000,000 micro-ops = 1 op
    const SCALE: i64 = 1_000_000;

    /// Zero throughput
    pub const ZERO: Self = Self(0);

    /// Create from micro-ops per second
    pub const fn from_micro_ops_per_sec(micro_ops: i64) -> Self {
        Self(micro_ops)
    }

    /// Create from ops per second (f64)
    pub fn from_ops_per_sec(ops: f64) -> Option<Self> {
        if ops < 0.0 || ops.is_nan() || ops.is_infinite() {
            return None;
        }
        let micro_ops = (ops * Self::SCALE as f64).round() as i64;
        Self::from_micro_ops_per_sec(micro_ops).checked()
    }

    /// Convert to ops per second (UI only)
    pub fn to_ops_per_sec(self) -> f64 {
        self.0 as f64 / Self::SCALE as f64
    }

    /// Get raw micro-ops value
    pub const fn to_raw(self) -> i64 {
        self.0
    }

    /// Create from raw (deserialization)
    pub const fn from_raw(raw: i64) -> Self {
        Self(raw)
    }

    /// Check if value is valid (non-negative)
    fn checked(self) -> Option<Self> {
        if self.0 < 0 {
            None
        } else {
            Some(self)
        }
    }
}

impl fmt::Display for FixedThroughput {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:.6} ops/sec", self.to_ops_per_sec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fixed_q32_32_basic() {
        let one = FixedQ32_32::ONE;
        assert_eq!(one.to_f64(), 1.0);

        let two = FixedQ32_32::from_i64(2).unwrap();
        assert_eq!(two.to_f64(), 2.0);

        let sum = one.checked_add(one).unwrap();
        assert_eq!(sum, two);
    }

    #[test]
    fn test_fixed_q32_32_mul() {
        let two = FixedQ32_32::from_i64(2).unwrap();
        let three = FixedQ32_32::from_i64(3).unwrap();
        let six = two.checked_mul(three).unwrap();
        assert!((six.to_f64() - 6.0).abs() < 1e-9);
    }

    #[test]
    fn test_fixed_q32_32_div() {
        let six = FixedQ32_32::from_i64(6).unwrap();
        let two = FixedQ32_32::from_i64(2).unwrap();
        let three = six.checked_div(two).unwrap();
        assert!((three.to_f64() - 3.0).abs() < 1e-9);
    }

    #[test]
    fn test_fixed_bps() {
        let bps = FixedBps::from_percent(5.5).unwrap();
        assert_eq!(bps.to_raw(), 550);
        assert!((bps.to_percent() - 5.5).abs() < 0.01);
    }

    #[test]
    fn test_fixed_ppm() {
        let ppm = FixedPpm::from_ratio(0.9999).unwrap();
        assert_eq!(ppm.to_raw(), 999900);
    }

    #[test]
    fn test_fixed_duration() {
        let dur = FixedDuration::from_seconds(5).unwrap();
        assert_eq!(dur.to_micros(), 5_000_000);
        assert_eq!(dur.to_seconds(), 5);
    }

    #[test]
    fn test_fixed_throughput() {
        let tp = FixedThroughput::from_ops_per_sec(1234.567).unwrap();
        assert!((tp.to_ops_per_sec() - 1234.567).abs() < 0.0001);
    }

    #[test]
    fn test_determinism() {
        // Same input should always produce same raw output
        let a = FixedQ32_32::from_f64(1.2345678901).unwrap();
        let b = FixedQ32_32::from_f64(1.2345678901).unwrap();
        assert_eq!(a.to_raw(), b.to_raw());
    }
}
