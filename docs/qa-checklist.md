# QA Checklist

## Installation
- [ ] Fresh install: extension loads without errors
- [ ] Onboarding wizard appears on first install
- [ ] Onboarding can create first system
- [ ] Onboarding can skip master password

## System Management
- [ ] Create system with required fields
- [ ] Edit system: update name, url, environment
- [ ] Delete system: confirmation prompt works
- [ ] Bulk select and delete
- [ ] Favorite toggle persists
- [ ] Search filters by name, url, remark

## Account Management
- [ ] Add multiple accounts to a system
- [ ] Set default account
- [ ] Show/hide password toggle
- [ ] Copy username, copy password, copy all
- [ ] Delete account

## Server Management
- [ ] Create server with IP, port, credentials
- [ ] Edit server
- [ ] Copy IP, copy SSH command, copy password
- [ ] Favorite toggle
- [ ] Search by name or IP

## Middleware Management
- [ ] Create Redis middleware (db field appears)
- [ ] Create MySQL middleware (charset, collation fields appear)
- [ ] Create RabbitMQ middleware (vhost field appears)
- [ ] Copy connection string
- [ ] Edit middleware

## Master Password
- [ ] Set master password
- [ ] Lock and unlock
- [ ] Wrong password rejected
- [ ] Change password
- [ ] Disable password (decrypts all fields)
- [ ] Auto-lock after configured minutes

## Auto-Fill
- [ ] Save a system with URL
- [ ] Navigate to that URL in a tab
- [ ] Badge "★" appears on extension icon
- [ ] Press Ctrl+Shift+L: form fills
- [ ] Multiple accounts: picker appears
- [ ] Right-click > "自动填充账号密码"

## Context Menus
- [ ] Right-click on page: "保存当前网站为内部系统" opens dashboard prefilled
- [ ] Right-click on matched page: "复制当前系统信息" copies to clipboard

## Import/Export
- [ ] Export Markdown without passwords: passwords are "********"
- [ ] Export Markdown with passwords: plaintext included
- [ ] Export JSON
- [ ] Import Markdown in merge mode: existing systems updated, new ones created
- [ ] Import Markdown in replace mode: all data wiped then imported
- [ ] Import JSON

## Preferences
- [ ] Theme toggle persists across sessions
- [ ] Default environment saves
- [ ] Auto-lock minutes saves
- [ ] Preferences sync via chrome.storage.sync

## Popup
- [ ] Popup opens in <100ms
- [ ] Search returns results across systems, servers, middleware
- [ ] Clicking system result opens URL in new tab
- [ ] Recent list shows last 5 accessed
- [ ] Favorites grid shows favorited systems
