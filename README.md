
# README

## Environement Setup

1. install devenv 

2. run `devenv shell` to enter the development environment.

## Running the Monorepo
To build all apps and packages, run the following command:

```sh
deven shell # login to the environment
pnpm run dev
```

## add new package to specific packages

```sh
 pnpm --filter web add -D drizzle-seed
```

## Run test 

You can run test by following command:

```sh
devenv shell -- pnpm run test

```

Also, the devenv allow to configure custom script. Here is an example script to run web app test.

```sh
$ devenv tasks run web:test
```

## Location for planning doc

Please put the planning doc in the `ai-docs` directory. 