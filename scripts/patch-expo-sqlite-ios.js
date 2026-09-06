const fs = require('fs');
const path = require('path');

const expoSQLiteRoot = path.dirname(require.resolve('expo-sqlite/package.json'));
const projectRoot = path.resolve(__dirname, '..');
const podfilePropertiesPath = path.join(projectRoot, 'ios', 'Podfile.properties.json');
let useSQLCipher = false;

if (fs.existsSync(podfilePropertiesPath)) {
  const podfileProperties = JSON.parse(fs.readFileSync(podfilePropertiesPath, 'utf8'));
  useSQLCipher = podfileProperties['expo.sqlite.useSQLCipher'] === 'true';
}

const headers = [
  'vendor/sqlite3/sqlite3.h',
  'vendor/sqlcipher/sqlite3.h',
].map((file) => path.join(expoSQLiteRoot, file));

for (const header of headers) {
  if (!fs.existsSync(header)) {
    continue;
  }

  const source = fs.readFileSync(header, 'utf8');
  const patched = source
    .replace('#ifndef SQLITE3_H\n#define SQLITE3_H', '#ifndef EXPO_SQLITE3_H\n#define EXPO_SQLITE3_H')
    .replace('#endif /* SQLITE3_H */', '#endif /* EXPO_SQLITE3_H */');

  if (patched !== source) {
    fs.writeFileSync(header, patched);
    console.log(`Patched expo-sqlite header: ${path.relative(process.cwd(), header)}`);
  }
}

const vendorDirectory = path.join(expoSQLiteRoot, 'vendor', useSQLCipher ? 'sqlcipher' : 'sqlite3');
const iosDirectory = path.join(expoSQLiteRoot, 'ios');

for (const file of ['sqlite3.c', 'sqlite3.h']) {
  const source = path.join(vendorDirectory, file);
  const destination = path.join(iosDirectory, file);
  fs.copyFileSync(source, destination);
  console.log(`Restored expo-sqlite source: ${path.relative(process.cwd(), destination)}`);
}

// Xcode 26 can associate a public header named `sqlite3.h` with the system
// SQLite module. Give Expo's prefixed declarations a unique public header name
// so they are reliably imported into the ExpoSQLite Swift module.
fs.copyFileSync(
  path.join(iosDirectory, 'sqlite3.h'),
  path.join(iosDirectory, 'ExpoSQLite3.h')
);

const podspecPath = path.join(iosDirectory, 'ExpoSQLite.podspec');
const podspec = fs.readFileSync(podspecPath, 'utf8');
const publicHeaderSetting = "  s.public_header_files = 'ExpoSQLite3.h'\n";
if (!podspec.includes(publicHeaderSetting)) {
  const patchedPodspec = podspec.replace(
    '  s.source_files = "**/*.{c,h,m,swift}"\n',
    `  s.source_files = "**/*.{c,h,m,swift}"\n${publicHeaderSetting}`
  );
  fs.writeFileSync(podspecPath, patchedPodspec);
  console.log('Patched ExpoSQLite public header name for Xcode 26');
}
