package config

import "os"

func AllowUnsigned() bool {
	return os.Getenv("DEV_ALLOW_UNSIGNED") == "1"
}
