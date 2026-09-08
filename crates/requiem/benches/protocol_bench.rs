use bytes::BytesMut;
use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use requiem::{frame_message, parse_frame, Frame, HelloPayload, MessageType};

fn benchmark_hello_roundtrip(c: &mut Criterion) {
    let hello = HelloPayload::new("reach-benchmark-client", "1.0.0");

    c.bench_function("protocol/hello_cbor_frame_roundtrip", |b| {
        b.iter(|| {
            let frame = frame_message(MessageType::Hello, black_box(&hello))
                .expect("benchmark hello payload must encode");
            let mut wire = BytesMut::new();
            frame
                .encode(&mut wire)
                .expect("benchmark frame must encode");
            let decoded_frame = Frame::decode(&mut wire)
                .expect("benchmark frame must decode")
                .expect("benchmark wire contains a complete frame");
            let decoded: HelloPayload =
                parse_frame(&decoded_frame).expect("benchmark hello payload must decode");
            black_box(decoded);
        });
    });
}

fn benchmark_binary_frames(c: &mut Criterion) {
    let mut group = c.benchmark_group("protocol/binary_frame_roundtrip");

    for payload_size in [64_usize, 4 * 1024, 1024 * 1024] {
        let frame = Frame::new(MessageType::ExecRequest, vec![0x5a; payload_size])
            .expect("benchmark payload is below the protocol limit");
        group.throughput(Throughput::Bytes(payload_size as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(payload_size),
            &frame,
            |b, frame| {
                b.iter(|| {
                    let mut wire = BytesMut::with_capacity(payload_size + 28);
                    frame
                        .encode(&mut wire)
                        .expect("benchmark frame must encode");
                    let decoded = Frame::decode(&mut wire)
                        .expect("benchmark frame must decode")
                        .expect("benchmark wire contains a complete frame");
                    black_box(decoded);
                });
            },
        );
    }

    group.finish();
}

criterion_group!(benches, benchmark_hello_roundtrip, benchmark_binary_frames);
criterion_main!(benches);
