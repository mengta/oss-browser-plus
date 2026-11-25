export const filesFixture = {
  buckets: [{ name: 'bucket-a', region: 'oss-cn-hangzhou' }],
  objects: [
    {
      name: 'a.txt',
      size: 12,
      lastModified: '2026-11-24T00:00:00.000Z',
      storageClass: 'Standard',
      type: 'file',
      etag: 'EtagA',
    },
    {
      name: 'dir/',
      size: 0,
      lastModified: '2026-11-24T00:00:00.000Z',
      storageClass: 'Standard',
      type: 'folder',
      etag: '',
    },
  ],
};