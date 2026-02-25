# electron

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```

### macOS signing/notarization

The macOS build uses hardened runtime and notarization. Set these environment variables
before running `pnpm build:mac`:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOURTEAMID"
```

For signing, provide either:

```bash
export CSC_NAME="Developer ID Application: Your Name (TEAMID)"
```

or a certificate file and password:

```bash
export CSC_LINK="file:///path/to/DeveloperID.p12"
export CSC_KEY_PASSWORD="your-p12-password"
```
