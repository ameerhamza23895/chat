# SSL Certificates for Development

This project uses self-signed SSL certificates for HTTPS development.

## Generating Certificates

Run the certificate generation script:

```bash
./generate-cert.sh
```

This will create:
- `certs/cert.pem` - SSL certificate
- `certs/key.pem` - Private key

The certificate is valid for:
- `localhost`
- `127.0.0.1`
- Your local network IP address (auto-detected)

## Using the Certificates

The Vite development server is configured to automatically use these certificates when they exist in the `certs/` directory.

1. **Generate certificates** (if not already done):
   ```bash
   ./generate-cert.sh
   ```

2. **Start the dev server**:
   ```bash
   npm run dev
   ```

3. **Access the application**:
   - Local: `https://localhost:3000`
   - Network: `https://<your-ip>:3000`

4. **Accept the security warning**:
   - Browsers will show a "Not Secure" or "Your connection is not private" warning
   - Click "Advanced" → "Proceed to localhost (unsafe)" or similar
   - This is normal for self-signed certificates in development

## Regenerating Certificates

If you need to regenerate certificates (e.g., IP address changed):

```bash
rm -rf certs
./generate-cert.sh
```

## Notes

- Certificates are valid for 365 days
- Certificates are git-ignored (don't commit them to version control)
- If certificates don't exist, Vite will fall back to auto-generated certificates
- These certificates are for **development only** - do not use in production
