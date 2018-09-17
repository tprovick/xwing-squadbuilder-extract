module.exports = xwingSBExtract;

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const git = require('nodegit');
const request = require('request-promise');
const prettier = require('prettier');

const defaultFFGApi =
  'https://squadbuilder.fantasyflightgames.com/api/cards/?game_format=7271f0fb-ec4f-4166-bcea-709cc1ee76cd';

function xwingSBExtract(targetRepo, newFFGApi, localPath) {
  const targetPath = path.resolve(
    __dirname,
    localPath ||
      (newFFGApi && newFFGApi.indexOf('http:') >= 0 ? newFFGApi : 'data'),
  );
  const repoUrl =
    targetRepo || 'https://github.com/guidokessels/xwing-data2.git';
  const ffgApi =
    newFFGApi && newFFGApi.indexOf('http:') >= 0 ? newFFGApi : defaultFFGApi;

  loadXWingDataFromRepo(repoUrl, targetPath)
    .then(() => {
      return pullSquadBuilderData(ffgApi);
    })
    .then((data) => {
      updateXWingData(targetPath, data.pilots, data.upgrades);
    })
    .catch((err) => {
      console.error(err);
    });
}

function getUpgradeTypeCode(cardType) {
  switch (cardType) {
    case 'astromech':
      return 10;
    case 'cannon':
      return 3;
    case 'configuration':
      return 18;
    case 'crew':
      return 8;
    case 'device':
      return 12;
    case 'force power':
      return 17;
    case 'gunner':
      return 16;
    case 'illicit':
      return 13;
    case 'missile':
      return 6;
    case 'modification':
      return 14;
    case 'sensor':
      return 2;
    case 'talent':
      return 1;
    case 'tech':
      return null;
    case 'title':
      return 15;
    case 'torpedo':
      return 5;
    case 'turret':
      return 4;
    default:
      return null;
  }
}

function updateXWingData(targetPath, pilots, upgrades) {
  const master = {
    conditions: [],
    damageDeck: [],
    upgrades: {},
    pilots: {},
  };

  let jsonStr = fs.readFileSync(path.resolve(targetPath, 'data/manifest.json'));

  const manifestData = JSON.parse(jsonStr);

  if (manifestData.upgrades) {
    for (const upgradeFilename of manifestData.upgrades) {
      jsonStr = fs.readFileSync(path.resolve(targetPath, upgradeFilename));

      const upgradeData = JSON.parse(jsonStr);
      console.log(
        `Loaded ${
          upgradeData.length
        } upgrades of type '${upgradeData[0].sides[0].type.toLowerCase()}'.`,
      );

      let n = 0;

      const cardType = getUpgradeTypeCode(
        upgradeData[0].sides[0].type.toLowerCase(),
      );
      for (const upgrade of upgradeData) {
        const upgradeSides = [];
        for (const side of upgrade.sides) {
          const ffgUpgrade = upgrades.find((el) => {
            if (
              el.name
                .replace(/[“”]/g, '"')
                .replace(/[’]/g, "'")
                .replace(/[–]/g, '-')
                .replace(/<(\/|)italic>/g, '') === side.title &&
              el.upgrade_types.includes(cardType)
            ) {
              let rMatch = true;

              for (const restriction of el.restrictions) {
                if (restriction[0].type === 'FACTION') {
                  if (upgrade.restrictions) {
                    rMatch = false;
                    /* eslint-disable-next-line max-depth */
                    for (const faction of upgrade.restrictions[0].factions) {
                      /* eslint-disable-next-line max-depth */
                      if (restriction[0].kwargs.name === faction) {
                        rMatch = true;
                        break;
                      }
                    }
                  }
                }
              }
              return rMatch;
            }
            return false;
          });
          /* eslint-disable-next-line max-depth */
          if (ffgUpgrade) {
            upgradeSides.push(ffgUpgrade);
            /* eslint-disable-next-line max-depth */
            if (ffgUpgrade.card_image) {
              side.image = ffgUpgrade.card_image;
            }
            /* eslint-disable-next-line max-depth */
            if (ffgUpgrade.image) {
              side.artwork = ffgUpgrade.image;
            }
            /* eslint-disable-next-line max-depth */
            if (upgradeSides[0].ffg_id) {
              /* eslint-disable-next-line camelcase */
              side.ffg_id = upgradeSides[0].ffg_id;
            }
          }
        }

        if (upgradeSides.length > 0) {
          /* eslint-disable-next-line max-depth */
          if (typeof upgradeSides[0].cost === 'string') {
            /* eslint-disable-next-line max-depth */
            if (upgradeSides[0].cost !== '*') {
              /* eslint-disable-next-line max-depth */
              if (upgrade.cost.value !== parseInt(upgradeSides[0].cost, 0)) {
                console.log(
                  `${upgrade.name} changed from ${upgrade.cost.value} to ${
                    upgradeSides[0].cost
                  }`,
                );
              }
              upgrade.cost = { value: parseInt(upgradeSides[0].cost, 0) };
            }
          }
          n++;
        } else {
          console.log(`Could not find upgrade ${upgrade.name} in FFG data.`);
        }
      }

      console.log(
        `Updated ${n} of ${
          upgradeData.length
        } upgrades of type '${upgradeData[0].sides[0].type.toLowerCase()}'.`,
      );

      fs.writeFileSync(
        path.resolve(targetPath, upgradeFilename),
        prettier.format(JSON.stringify(upgradeData), { parser: 'json' }),
      );
    }
  }

  // TODO: Add pilot extraction logic
  /* 
    if (manifestData.pilots) {
      for (const faction of manifestData.pilots) {
        if (faction.ships) {
          for (const shipFilename of faction.ships) {
            jsonStr = fs.readFileSync(path.resolve(targetPath, shipFilename));
  
            const shipId = shipFilename
              .match(/\/([^/.]*)\./)[1]
              .replace(/-/g, '');
            const shipData = JSON.parse(jsonStr);
            /* eslint-disable-next-line max-depth * /
            if (shipData.pilots) {
              /* eslint-disable-next-line max-depth * /
              for (const pilotData of shipData.pilots) {
                const newPilot = {
                  id: pilotData.xws,
                  shipId,
                  name: pilotData.name,
                  initiative: pilotData.initiative,
                  unique: pilotData.limited === 1,
                  cost: pilotData.cost,
                  text: pilotData.text,
                  imageSrc: pilotData.image || null,
                  shipName: shipData.name,
                  size: shipData.size,
                  faction: faction.faction,
                };
                /* eslint-disable-next-line max-depth * /
                for (const stat of shipData.stats) {
                  /* eslint-disable-next-line max-depth * /
                  if (['agility', 'hull', 'shields'].includes(stat.type)) {
                    newPilot[stat.type] = stat.value;
                  }
                }
                master.pilots[pilotData.xws] = newPilot;
              }
            }
          }
        }
      }
    }
    */
  return master;
}

function pullSquadBuilderData(ffgApi) {
  return request({
    method: 'get',
    uri: ffgApi,
    json: true,
  }).then((response) => {
    console.log(response);
    const pilots = [];
    const upgrades = [];
    for (const card of response.cards) {
      switch (card.card_type_id) {
        case 1:
          pilots.push(card);
          break;
        case 2:
          upgrades.push(card);
          break;
        default:
          break;
      }
    }
    return { pilots, upgrades };
  });
}

/* eslint-disable no-unused-vars */
function loadXWingDataFromRepo(repoUrl, targetPath) {
  if (fs.existsSync(targetPath)) {
    rimraf.sync(targetPath + '\\{*,.*}');
  } else {
    mkDirByPathSync(targetPath);
  }

  /* eslint-disable new-cap */
  return git.Clone(repoUrl, targetPath);
}

function mkDirByPathSync(targetDir, { isRelativeToScript = false } = {}) {
  const sep = path.sep;
  const initDir = path.isAbsolute(targetDir) ? sep : '';
  const baseDir = isRelativeToScript ? __dirname : '.';

  return targetDir.split(sep).reduce((parentDir, childDir) => {
    const curDir = path.resolve(baseDir, parentDir, childDir);
    try {
      fs.mkdirSync(curDir);
    } catch (err) {
      if (err.code === 'EEXIST') {
        // curDir already exists!
        return curDir;
      }

      // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
      if (err.code === 'ENOENT') {
        // Throw the original parentDir error on curDir `ENOENT` failure.
        throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
      }

      const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
      if (!caughtErr || (caughtErr && targetDir === curDir)) {
        throw err; // Throw if it's just the last created dir.
      }
    }

    return curDir;
  }, initDir);
}
