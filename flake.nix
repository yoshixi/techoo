{
  description = "Techoo development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        python = pkgs.python312.withPackages (ps: [ ps.setuptools ]);
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.git
            pkgs.nodejs_24
            pkgs.turso-cli
            pkgs.bundletool
            pkgs.android-tools
            pkgs.jdk17
            pkgs.wrangler
            python
          ];

          shellHook = ''
            corepack prepare pnpm@11.20.0 --activate
            # Turbo needs a real pnpm binary on PATH (corepack enable cannot
            # symlink into the read-only nix store, so use corepack shims).
            export PATH="$(dirname "$(command -v node)")/../lib/node_modules/corepack/shims:$PATH"

            # Load .env if it exists
            if [ -f .env ]; then
              set -a
              source .env
              set +a
            fi
          '';
        };
      }
    );
}
