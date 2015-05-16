if [ -d dist ]
	then
		rm -r dist
fi
mkdir -p dist
cp LICENSE  dist/
cp main* dist/
cp manifest.json dist/
cp README.md dist/
cp -r svg/ dist/
cp mail-postbox-icon.png dist/