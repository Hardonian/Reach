.PHONY: doctor release-artifacts go-module-sanity

doctor:
	cd tools/doctor && go run .

release-artifacts:
	./tools/release/build.sh


go-module-sanity:
	./tools/ci/go-test-modules.sh
