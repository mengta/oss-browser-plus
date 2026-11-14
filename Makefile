
VERSION=1.19.2
NAME=oss-browser
CUSTOM=./custom

# P5-03：electron-builder（26.18.0）替代 electron-packager 7.1.0
# 目标名保持不变：win64/win32/linux64/linux32/mac/dmg（升级文档 D6）
# 旧 win 图标/版本信息 hack 已废弃：electron-builder 内置处理
BUILDER=npx electron-builder
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
BUILDER_ENV=ELECTRON_MIRROR=$(ELECTRON_MIRROR) ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

ELECTON=./node_modules/.bin/electron

i:
	cnpm i
clean:
	rm -rf dist node_modules build releases node/crc64/cpp-addon/node_modules node/crc64/electron-crc64-prebuild/node_modules node/ossstore/node_modules
dev:
	NODE_ENV=development ${ELECTON} . --inspect=5858
debug:
	NODE_ENV=development ${ELECTON} . --inspect-brk=5858

run:
	custom=$(CUSTOM) npm run dev

prod:
	npm run prod
watch:
	node build.mjs --watch
build:
	node build.mjs --dist-install
	node gen.js

win64:
	node build.mjs --dist-install
	$(BUILDER_ENV) $(BUILDER) --win --x64
	rm -rf releases/$(VERSION)/$(NAME)-win32-x64.zip && mkdir -p releases/$(VERSION)
	cp build/$(NAME)-1.19.2-x64.zip releases/$(VERSION)/$(NAME)-win32-x64.zip 2>/dev/null || cp build/*win*x64*.zip releases/$(VERSION)/$(NAME)-win32-x64.zip
win32:
	node build.mjs --dist-install
	$(BUILDER_ENV) $(BUILDER) --win --ia32
	rm -rf releases/$(VERSION)/$(NAME)-win32-ia32.zip && mkdir -p releases/$(VERSION)
	cp build/*win*ia32*.zip releases/$(VERSION)/$(NAME)-win32-ia32.zip 2>/dev/null || echo "ia32 产物见 build/ 目录（命名以 builder 输出为准）"
linux64:
	node build.mjs --dist-install
	$(BUILDER_ENV) $(BUILDER) --linux --x64
	mkdir -p releases/$(VERSION)
	cp build/*linux*x64*.zip releases/$(VERSION)/$(NAME)-linux-x64.zip 2>/dev/null || echo "linux x64 产物见 build/ 目录"
linux32:
	node build.mjs --dist-install
	$(BUILDER_ENV) $(BUILDER) --linux --ia32
	mkdir -p releases/$(VERSION)
	cp build/*linux*ia32*.zip releases/$(VERSION)/$(NAME)-linux-ia32.zip 2>/dev/null || echo "linux ia32 产物见 build/ 目录（Electron 4+ 已停止 Linux ia32 支持，见 D6-ia32 决策）"
mac:
	node build.mjs --dist-install
	$(BUILDER_ENV) $(BUILDER) --mac --x64
	mkdir -p releases/$(VERSION)
	cp build/*mac*x64*.zip releases/$(VERSION)/$(NAME)-darwin-x64.zip 2>/dev/null || echo "mac 产物见 build/ 目录"
dmg:
	node build.mjs --dist-install
	$(BUILDER_ENV) $(BUILDER) --mac dmg --x64
	mkdir -p releases/$(VERSION)
	cp build/*.dmg releases/$(VERSION)/$(NAME).dmg 2>/dev/null || echo "dmg 产物见 build/ 目录"
all:win32 win64 linux32 linux64 mac dmg
	@echo 'Done'

.PHONY:build win64 win32 linux64 linux32 mac dmg all
