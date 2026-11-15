package config

import (
	"os"

	"github.com/spf13/viper"
)

type ArgoConfig struct {
	ServerURL string `mapstructure:"server_url"`
	Namespace string `mapstructure:"namespace"`
}

type S3Config struct {
	Endpoint  string `mapstructure:"endpoint"`
	Bucket    string `mapstructure:"bucket"`
	UseSSL    bool   `mapstructure:"use_ssl"`
	AccessKey string `mapstructure:"access_key"`
	SecretKey string `mapstructure:"secret_key"`
}

type Config struct {
	ListenAddr  string     `mapstructure:"listen_addr"`
	DatabaseURL string     `mapstructure:"database_url"`
	Argo        ArgoConfig `mapstructure:"argo"`
	S3          S3Config   `mapstructure:"s3"`
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
