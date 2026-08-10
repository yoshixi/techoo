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
            pnpm() { corepack pnpm "$@"; }
            export -f pnpm

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
