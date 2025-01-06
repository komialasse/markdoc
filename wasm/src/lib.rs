
use operational_transform::OperationSeq;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Default, Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct OpSeq(OperationSeq);

#[wasm_bindgen]
#[derive(Default, Clone, Debug, PartialEq)]
pub struct OpSeqPair(OpSeq, OpSeq);


#[wasm_bindgen]
impl OpSeq {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_capacity(capacity: usize) -> Self {
        Self(OperationSeq::with_capacity(capacity))
    }

    pub fn compose(&self, other: &OpSeq) -> Option<OpSeq> {
        self.0.compose(&other.0).ok().map(Self)
    }

    pub fn delete(&mut self, n: u32) {
        self.0.delete(n as u64)
    }

    pub fn insert(&mut self, s: &str) {
        self.0.insert(s)
    }

    pub fn retain(&mut self, n: u32) {
        self.0.retain(n as u64)
    }

    pub fn transform(&self, other: &OpSeq) -> Option<OpSeqPair> {
        let (a, b) = self.0.transform(&other.0).ok()?;
        Some(OpSeqPair(Self(a), Self(b)))
    }

    pub fn apply(&self, s: &str) -> Option<String> {
        self.0.apply(s).ok()
    }

    pub fn invert(&self, s: &str) -> Self {
        Self(self.0.invert(s))
    }

    #[inline]
    pub fn is_noop(&self) -> bool {
        self.0.is_noop()
    }

    #[inline]
    pub fn base_len(&self) -> usize {
        self.0.base_len()
    }

    #[inline]
    pub fn target_len(&self) -> usize {
        self.0.target_len()
    }

    pub fn transform_index(&self, position: u32) -> u32 {
        let mut index = position as i32;
        let mut new_index = index;
        for op in self.0.ops() {
            use operational_transform::Operation::*;
            match op {
                &Retain(n) => index -= n as i32,
                Insert(s) => new_index += bytecount::num_chars(s.as_bytes()) as i32,
                &Delete(n) => {
                    new_index -= std::cmp::min(index, n as i32);
                    index -= n as i32;
                }
            }
            if index < 0 {
                break;
            }
        }
        new_index as u32
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<OpSeq> {
        serde_json::from_str(s).ok()
    }

    #[allow(clippy::inherent_to_string)]
    pub fn to_string(&self) -> String {
        serde_json::to_string(self).expect("json serialization failure")
    }
}

#[wasm_bindgen]
impl OpSeqPair {
    pub fn first(&self) -> OpSeq {
        self.0.clone()
    }

    pub fn second(&self) -> OpSeq {
        self.1.clone()
    }
}
