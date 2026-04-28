package draw

import (
	"fmt"
	"os"
)

type diskBuffer struct {
	file         *os.File
	bytesWritten uint32
}

func newDiskBuffer(dir, pattern string) (*diskBuffer, error) {
	f, err := os.CreateTemp(dir, pattern)
	if err != nil {
		return nil, fmt.Errorf("create temp file for %s: %w", pattern, err)
	}
	return &diskBuffer{file: f}, nil
}

func (db *diskBuffer) write(data []byte) error {
	if len(data) == 0 {
		return nil
	}
	_, err := db.file.WriteAt(data, int64(db.bytesWritten))
	if err != nil {
		return err
	}
	db.bytesWritten += uint32(len(data))
	return nil
}

func (db *diskBuffer) readSlice(startByte, length uint32) ([]byte, error) {
	if length == 0 || startByte >= db.bytesWritten {
		return nil, nil
	}
	end := startByte + length
	if end > db.bytesWritten {
		end = db.bytesWritten
	}
	buf := make([]byte, end-startByte)
	_, err := db.file.ReadAt(buf, int64(startByte))
	if err != nil {
		return nil, err
	}
	return buf, nil
}

func (db *diskBuffer) close() {
	if db == nil || db.file == nil {
		return
	}
	name := db.file.Name()
	_ = db.file.Close()
	_ = os.Remove(name)
}
