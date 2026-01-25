# Development Environment

This project uses [devenv](https://devenv.sh/) to manage the development environment. This ensures that all developers use the same versions of tools like Node.js and pnpm.

## Entering the Environment

To enter the development environment, run the following command in your terminal:

```bash
devenv shell
```

This will open a subshell with all the necessary tools available in your PATH.

## Tooling and Packages

### Node.js and pnpm

Once inside the `devenv shell`, you should use **pnpm** for all Node.js related operations:

- **Installing packages**: Use `pnpm install`.
- **Running scripts**: Use `pnpm run <script-name>` (e.g., `pnpm run dev`, `pnpm run build`).
- **Adding dependencies**: Use `pnpm add <package-name>`.

> [!IMPORTANT]
> Always perform these operations **inside** the `devenv shell` to ensure you are using the correct Node.js version and toolchain defined for this project.
