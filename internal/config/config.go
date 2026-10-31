package config

import (
	"os"

	"github.com/spf13/viper"
)

type Config struct {
	ListenAddr  string `mapstructure:"listen_addr"`
	DatabaseURL string `mapstructure:"database_url"`
}

func Load() (*Config, error) {
	v := viper.New()

	path := os.Getenv("CONFIG_PATH")

	v.SetConfigName("apiserver")
	v.SetConfigType("yaml")
	v.SetConfigFile(path)

	if err := v.ReadInConfig(); err != nil {
		return nil, err
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
