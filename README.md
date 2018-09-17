# X-Wing Squad Builder Data Extractor

This small library extracts the latest data from the FFG Squad Builder application, downloads the xwing-data2 repo, and applies any changes to the xwing-data2 data files before running them against prettier to ensure consistent formatting. Committing those files and creating a pull request against the desired repository is left for users.

This is intended to be used on https://github.com/guidokessels/xwing-data2 or any forks following that format.

## API

```
xwingSBExtractor([targetGitRepo[, ffgApiUrl[, localPath]]])
```

`targetGitRepo:` The URL of the xwing-data2 repository to download the data files from. Defaults to https://github.com/guidokessels/xwing-data2

`ffgApiUrl:` The URL of the X-Wing Squad Builder API to pull the card data from. Defaults to the Extended format at https://squadbuilder.fantasyflightgames.com/api/cards/?game_format=7271f0fb-ec4f-4166-bcea-709cc1ee76cd

`localPath:` The path, relative to the library, to download the files to. Defaults to 'data'.

## Usage

You can use the library in your own application by including the following:

```
var xwingSBExtractor = require('xwing-squadbuilder-extract')

xwingSBExtractor('https://github.com/guidokessels/xwing-data2', ffgAPI, localPath)
```

Or, if you run this project with:

```
node index.js
```

It will extract the data using the default settings

## Notes

This library hasn't been packaged up cleanly as an npm module yet, but that will probably come later.

The extractor **ONLY** pulls upgrade data and not pilot data. Expect that to come pretty soon.
