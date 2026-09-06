const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'assets', 'js', 'device-compat.js'),
  'utf8'
);

function createContext(isMobile) {
  const assigned = [];
  const context = {
    window: {
      navigator: { maxTouchPoints: isMobile ? 1 : 0 },
      matchMedia(query) {
        return { matches: isMobile && (query.includes('max-width') || query.includes('pointer')) };
      },
      location: { assign(url) { assigned.push(url); } },
      open() { return isMobile ? null : { opener: {} }; }
    },
    document: {
      createElement() {
        return {
          className: '', textContent: '', rel: '', hidden: false,
          removeAttribute(name) { delete this[name]; }
        };
      }
    }
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { api: context.window.KHOA_DUOC_DEVICE, assigned };
}

const mobile = createContext(true);
const mobileLink = {};
mobile.api.configurePdfLink(mobileLink);
assert.strictEqual(mobileLink.target, '_self', 'Điện thoại phải mở PDF trong cùng thẻ.');
mobile.api.openPdf('/ban-tin.pdf');
assert.deepStrictEqual(mobile.assigned, ['/ban-tin.pdf']);

const desktop = createContext(false);
const desktopLink = {};
desktop.api.configurePdfLink(desktopLink);
assert.strictEqual(desktopLink.target, '_blank', 'Máy tính có thể mở PDF trong thẻ mới.');
assert.strictEqual(desktopLink.rel, 'noopener noreferrer');

console.log('Đã kiểm tra tương thích mở PDF trên điện thoại và máy tính: OK');
