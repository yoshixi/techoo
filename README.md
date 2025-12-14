
# Environement Setup

1. install devenv 

2. run `devenv shell` to enter the development environment.

# Running the Monorepo
To build all apps and packages, run the following command:

```sh
deven shell # login to the environment
pnpm run dev
```

# add new package to specific packages

```js
 pnpm --filter web add -D drizzle-seed
```
```

# Run test 

The devenv allow to configure custom script. Here is an example script to run web app test.

$ devenv tasks run web:test
```

