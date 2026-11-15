package s3

import (
	"context"
	"fmt"
	"io"
	"log"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/AnarCom/p-graph/internal/storage"
)

type ObjectStorage struct {
	client *minio.Client
	bucket string
}

func NewObjectStorage(endpoint, accessKey, secretKey, bucket string, useSSL bool) (*ObjectStorage, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		log.Printf("s3 storage: create client %s: %v", endpoint, err)
		return nil, fmt.Errorf("create object storage: %w", storage.ErrStorage)
	}
	return &ObjectStorage{client: client, bucket: bucket}, nil
}

func (s *ObjectStorage) EnsureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		log.Printf("s3 storage: check bucket %s: %v", s.bucket, err)
		return fmt.Errorf("ensure bucket: %w", storage.ErrStorage)
	}
	if !exists {
		if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
			log.Printf("s3 storage: create bucket %s: %v", s.bucket, err)
			return fmt.Errorf("ensure bucket: %w", storage.ErrStorage)
		}
	}
	return nil
}

func (s *ObjectStorage) Put(ctx context.Context, key, contentType string, r io.Reader, size int64) error {
	if _, err := s.client.PutObject(ctx, s.bucket, key, r, size, minio.PutObjectOptions{
		ContentType: contentType,
	}); err != nil {
		log.Printf("s3 storage: put object %s/%s: %v", s.bucket, key, err)
		return fmt.Errorf("put object: %w", storage.ErrStorage)
	}
	return nil
}

func (s *ObjectStorage) Remove(ctx context.Context, key string) error {
	if err := s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{}); err != nil {
		log.Printf("s3 storage: remove object %s/%s: %v", s.bucket, key, err)
		return fmt.Errorf("remove object: %w", storage.ErrStorage)
	}
	return nil
}
