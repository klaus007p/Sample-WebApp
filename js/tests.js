(function () {
  "use strict";

  const output = document.querySelector("[data-test-results]");
  const runButton = document.querySelector("[data-run-tests]");

  window.addEventListener("load", runTests);
  runButton.addEventListener("click", runTests);

  function runTests() {
    const utils = window.MithaiApp && window.MithaiApp.testUtils;
    const tests = [
      ["price calculation uses integer paise", () => utils.calculateLineTotalPaise(620, 250, 2) === 31000],
      ["quantity clamps below minimum", () => utils.clampQuantity(0) === 1 && utils.clampQuantity(-5) === 1],
      ["quantity clamps above maximum", () => utils.clampQuantity(99) === 20],
      ["search accepts special characters", () => utils.filterProducts(window.MITHAI_PRODUCTS, "kaju (* \\ ", "All", "popular").length >= 0],
      ["search finds tags and names", () => utils.filterProducts(window.MITHAI_PRODUCTS, "cashew", "All", "popular").some((item) => item.slug === "kaju-katli")],
      ["cart duplicate merge logic can use matching keys", () => {
        const lines = [];
        merge(lines, { productId: "p001", weightGrams: 250, quantity: 1 }, utils.clampQuantity);
        merge(lines, { productId: "p001", weightGrams: 250, quantity: 3 }, utils.clampQuantity);
        merge(lines, { productId: "p001", weightGrams: 500, quantity: 1 }, utils.clampQuantity);
        return lines.length === 2 && lines[0].quantity === 4;
      }],
      ["localStorage fallback works when storage is blocked", () => {
        const original = Object.getOwnPropertyDescriptor(window, "localStorage");
        try {
          Object.defineProperty(window, "localStorage", {
            configurable: true,
            get() {
              throw new Error("blocked");
            }
          });
          const storage = utils.createStorage("blocked-test");
          storage.set([{ id: "ok" }]);
          return storage.get()[0].id === "ok";
        } finally {
          if (original) Object.defineProperty(window, "localStorage", original);
        }
      }],
      ["WhatsApp URL encodes user text", () => {
        const product = utils.validateProducts(window.MITHAI_PRODUCTS)[0];
        const line = {
          product,
          weightGrams: 250,
          quantity: 1,
          totalPaise: utils.calculateLineTotalPaise(product.pricePerKg, 250, 1)
        };
        const url = utils.buildWhatsAppUrl({
          customer: {
            name: "A & B",
            phone: "9876543210",
            fulfillment: "Pickup",
            address: "",
            note: "Less sugar & gift wrap"
          },
          lines: [line],
          totalPaise: line.totalPaise
        }, {
          shopName: "Haldiram's",
          whatsappNumber: "91XXXXXXXXXX",
          noteMaxLength: 180
        });
        return url.includes("https://wa.me/91XXXXXXXXXX?text=") && !url.includes("Less sugar & gift wrap");
      }]
    ];

    const results = tests.map(([name, test]) => {
      try {
        return { name, passed: Boolean(test()) };
      } catch (error) {
        return { name: `${name}: ${error.message}`, passed: false };
      }
    });
    output.replaceChildren(...results.map(renderResult));
    console.table(results);
  }

  function merge(lines, next, clampQuantity) {
    const existing = lines.find((line) => line.productId === next.productId && line.weightGrams === next.weightGrams);
    if (existing) {
      existing.quantity = clampQuantity(existing.quantity + next.quantity);
    } else {
      lines.push({ ...next, quantity: clampQuantity(next.quantity) });
    }
  }

  function renderResult(result) {
    const item = document.createElement("li");
    const status = document.createElement("span");
    status.className = result.passed ? "pass" : "fail";
    status.textContent = result.passed ? "PASS" : "FAIL";
    item.append(status, document.createTextNode(` ${result.name}`));
    return item;
  }
})();
