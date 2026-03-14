import request from 'supertest';

import { createApp } from '../app.js';

describe('cors policy', () => {
  it('allows localhost browser origins for the frontend', async () => {
    const response = await request(createApp())
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does not grant arbitrary third-party browser origins access to the api', async () => {
    const response = await request(createApp())
      .get('/api/health')
      .set('Origin', 'https://evil.example');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
