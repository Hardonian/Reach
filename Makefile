.PHONY: doctor release-artifacts

doctor:
	cd tools/doctor && go run .

release-artifacts:
	./tools/release/build.sh
