#!/bin/sh
# Builds the app and publishes dist/ to the gh-pages branch, which GitHub Pages serves.
set -e
cd "$(dirname "$0")"
npm test
npm run build
touch dist/.nojekyll
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Deploy $(git -C .. rev-parse --short HEAD)"
git -c credential.helper='!gh auth git-credential' push -f "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
