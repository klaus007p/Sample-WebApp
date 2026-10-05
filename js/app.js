(function () {
  "use strict";

  const CONFIG = {
    shopName: "Haldiram's",
    tagline: "Pure ghee sweets, made fresh daily",
    phoneDisplay: "+91XXXXXXXXXX",
    whatsappNumber: "91XXXXXXXXXX",
    address: "FULL ADDRESS",
    hoursLabel: "9:00 AM - 10:00 PM, all days",
    mapsLink: "",
    instagramLink: "",
    timezone: "Asia/Kolkata",
    openingHours: {
      days: [0, 1, 2, 3, 4, 5, 6],
      open: "09:00",
      close: "22:00"
    },
    currency: "INR",
    maxQuantity: 20,
    noteMaxLength: 180,
    whatsappMaxUrlLength: 1900
  };

  const WEIGHTS = [250, 500, 1000];
  const CATEGORIES = ["All", "Milk-based", "Ghee-based", "Dry Fruit", "Bengali", "Halwa", "Festival Special"];
  const CART_KEY = "haldirams-sweet-box-v1";
  const BAD_STORAGE_NOTICE = "Your saved cart was refreshed because some items changed or were unavailable.";

  const state = {
    products: [],
    category: "All",
    query: "",
    sort: "popular",
    cart: [],
    storage: createStorage(CART_KEY),
    lastFocus: null,
    submitLock: false
  };

  const dom = {};
  const money = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: CONFIG.currency,
    maximumFractionDigits: 0
  });

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheDom();
    applyShopDetails();
    state.products = validateProducts(window.MITHAI_PRODUCTS || []);
    renderCategories();
    loadCart();
    renderProducts();
    renderCart();
    bindEvents();
    updateOpenStatus();
    setInterval(updateOpenStatus, 60 * 1000);
    registerServiceWorker();
    window.MithaiApp = {
      testUtils: {
        calculateLineTotalPaise,
        clampQuantity,
        filterProducts,
        createStorage,
        buildWhatsAppUrl,
        validateProducts,
        normalizeQuery
      }
    };
  }

  function cacheDom() {
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    Object.assign(dom, {
      $,
      $$,
      grid: $("[data-product-grid]"),
      template: $("#product-card-template"),
      filters: $("[data-category-filters]"),
      search: $("[data-search-input]"),
      sort: $("[data-sort-select]"),
      resultCount: $("[data-result-count]"),
      emptyState: $("[data-empty-state]"),
      clearFilters: $("[data-clear-filters]"),
      cartDrawer: $("[data-cart-drawer]"),
      cartPanel: $(".cart-drawer__panel"),
      cartItems: $("[data-cart-items]"),
      cartEmpty: $("[data-cart-empty]"),
      cartTotal: $("[data-cart-total]"),
      cartCount: $("[data-cart-count]"),
      cartNotice: $("[data-cart-notice]"),
      checkoutForm: $("[data-checkout-form]"),
      checkoutButton: $("[data-checkout-button]"),
      addressField: $("[data-address-field]"),
      modal: $("[data-product-modal]"),
      modalPanel: $(".product-modal__panel"),
      modalContent: $("[data-modal-content]"),
      toast: $("[data-toast]"),
      announcer: $("[data-announcer]"),
      mobileMenu: $("[data-mobile-menu]"),
      mobileMenuPanel: $(".mobile-menu__panel"),
      menuOpen: $("[data-menu-open]"),
      year: $("[data-year]"),
      openStatus: $("[data-open-status]")
    });
  }

  function applyShopDetails() {
    document.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
      link.href = buildSimpleWhatsAppLink("Namaste Haldiram's, I would like to place an order.");
    });
    document.querySelectorAll("[data-phone-link]").forEach((link) => {
      link.href = `tel:${CONFIG.phoneDisplay}`;
      link.textContent = CONFIG.phoneDisplay;
    });
    const address = document.querySelector("[data-address]");
    if (address) address.textContent = CONFIG.address;
    const hours = document.querySelector("[data-hours]");
    if (hours) hours.textContent = CONFIG.hoursLabel;
    const mapLink = document.querySelector("[data-map-link]");
    if (mapLink) {
      if (CONFIG.mapsLink) {
        mapLink.href = CONFIG.mapsLink;
        mapLink.removeAttribute("aria-disabled");
      } else {
        mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONFIG.address)}`;
      }
    }
    const instagram = document.querySelector("[data-instagram-link]");
    if (instagram) {
      instagram.href = CONFIG.instagramLink || "#";
      if (!CONFIG.instagramLink) instagram.setAttribute("aria-disabled", "true");
    }
    if (dom.year) dom.year.textContent = String(new Date().getFullYear());
  }

  function validateProducts(rawProducts) {
    if (!Array.isArray(rawProducts)) return [];
    const seen = new Set();
    return rawProducts.reduce((valid, item, index) => {
      const product = {
        id: safeString(item.id) || `generated-${index}`,
        slug: slugify(safeString(item.slug) || safeString(item.name) || `sweet-${index}`),
        name: safeString(item.name) || "Fresh Mithai",
        hindiName: safeString(item.hindiName),
        category: CATEGORIES.includes(item.category) ? item.category : "Festival Special",
        description: safeString(item.description) || "Freshly prepared mithai from our daily selection.",
        pricePerKg: Number.isFinite(Number(item.pricePerKg)) && Number(item.pricePerKg) > 0 ? Math.round(Number(item.pricePerKg)) : 0,
        minOrderGrams: Number.isFinite(Number(item.minOrderGrams)) ? Math.max(250, Math.round(Number(item.minOrderGrams))) : 250,
        isVeg: item.isVeg !== false,
        isBestseller: Boolean(item.isBestseller),
        isAvailable: item.isAvailable !== false,
        tags: Array.isArray(item.tags) ? item.tags.map(safeString).filter(Boolean).slice(0, 10) : [],
        emoji: safeString(item.emoji) || "◇"
      };
      if (seen.has(product.id) || !product.pricePerKg) {
        console.warn("Skipping invalid product", item);
        return valid;
      }
      seen.add(product.id);
      valid.push(product);
      return valid;
    }, []);
  }

  function bindEvents() {
    dom.search.addEventListener("input", debounce(() => {
      state.query = normalizeQuery(dom.search.value);
      renderProducts();
    }, 180));
    dom.sort.addEventListener("change", () => {
      state.sort = dom.sort.value;
      renderProducts();
    });
    dom.clearFilters.addEventListener("click", () => {
      state.category = "All";
      state.query = "";
      dom.search.value = "";
      renderCategories();
      renderProducts();
    });
    document.querySelectorAll("[data-cart-open]").forEach((button) => {
      button.addEventListener("click", () => openLayer("cart", button));
    });
    document.querySelectorAll("[data-cart-close]").forEach((button) => {
      button.addEventListener("click", closeCart);
    });
    document.querySelectorAll("[data-modal-close]").forEach((button) => {
      button.addEventListener("click", closeModal);
    });
    dom.checkoutForm.addEventListener("submit", handleCheckout);
    dom.checkoutForm.fulfillment.forEach((radio) => {
      radio.addEventListener("change", updateFulfillmentFields);
    });
    dom.menuOpen.addEventListener("click", () => openLayer("menu", dom.menuOpen));
    document.querySelectorAll("[data-menu-close], .mobile-menu a").forEach((item) => {
      item.addEventListener("click", closeMenu);
    });
    document.querySelector("[data-floating-whatsapp]").addEventListener("click", () => {
      window.open(buildSimpleWhatsAppLink("Namaste Haldiram's, I would like to enquire about sweets."), "_blank", "noopener");
    });
    document.addEventListener("keydown", handleGlobalKeydown);
  }

  function renderCategories() {
    replaceChildren(dom.filters, CATEGORIES.map((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.textContent = category;
      button.setAttribute("aria-pressed", String(category === state.category));
      button.addEventListener("click", () => {
        state.category = category;
        renderCategories();
        renderProducts();
      });
      return button;
    }));
  }

  function renderProducts() {
    const products = filterProducts(state.products, state.query, state.category, state.sort);
    replaceChildren(dom.grid, products.map(createProductCard));
    dom.emptyState.hidden = products.length > 0;
    dom.resultCount.textContent = `${products.length} sweet${products.length === 1 ? "" : "s"} shown`;
    announce(dom.resultCount.textContent);
  }

  function createProductCard(product) {
    const node = dom.template.content.firstElementChild.cloneNode(true);
    const image = node.querySelector("img");
    const placeholder = node.querySelector(".product-card__placeholder");
    const badges = node.querySelector(".product-card__badges");
    const titleButtons = node.querySelectorAll("[data-open-product]");
    const title = node.querySelector(".product-card__title");
    const hindi = node.querySelector(".product-card__hindi");
    const description = node.querySelector(".product-card__description");
    const price = node.querySelector(".product-card__price");
    const category = node.querySelector(".product-card__category");
    const select = node.querySelector("[data-weight-select]");
    const livePrice = node.querySelector("[data-live-price]");
    const add = node.querySelector("[data-add-to-cart]");

    node.dataset.productId = product.id;
    image.alt = `${product.name} mithai`;
    image.hidden = true;
    loadProductImage(image, placeholder, product);
    placeholder.textContent = product.emoji;

    renderBadges(badges, product);
    title.textContent = product.name;
    hindi.textContent = product.hindiName || product.category;
    description.textContent = product.description;
    price.textContent = `${money.format(product.pricePerKg)} / kg`;
    category.textContent = product.category;
    setWeightOptions(select, product.minOrderGrams);

    const updatePrice = () => {
      livePrice.textContent = money.format(calculateLineTotalPaise(product.pricePerKg, Number(select.value), 1) / 100);
    };
    select.addEventListener("change", updatePrice);
    updatePrice();

    titleButtons.forEach((button) => {
      button.addEventListener("click", () => openProduct(product, button));
    });

    if (!product.isAvailable) {
      add.disabled = true;
      add.textContent = "Sold Out";
    } else {
      add.addEventListener("click", () => addToCart(product.id, Number(select.value), 1));
    }
    return node;
  }

  function renderBadges(container, product) {
    const badges = [];
    if (product.isBestseller) badges.push(["Bestseller", ""]);
    if (!product.isAvailable) badges.push(["Sold Out", "badge--sold"]);
    if (product.isVeg) badges.push(["Pure Veg", "badge--veg"]);
    replaceChildren(container, badges.map(([label, modifier]) => {
      const badge = document.createElement("span");
      badge.className = `badge ${modifier}`.trim();
      badge.textContent = label;
      return badge;
    }));
  }

  function loadProductImage(image, placeholder, product) {
    const imageUrl = `assets/images/${product.slug}.webp`;
    if (!window.fetch || location.protocol === "file:") return;
    fetch(imageUrl, { method: "HEAD", cache: "force-cache" })
      .then((response) => {
        if (!response.ok) return;
        image.addEventListener("load", () => {
          image.hidden = false;
          placeholder.hidden = true;
        }, { once: true });
        image.addEventListener("error", () => {
          image.hidden = true;
          placeholder.hidden = false;
        }, { once: true });
        image.src = imageUrl;
      })
      .catch(() => {
        image.hidden = true;
        placeholder.hidden = false;
      });
  }

  function setWeightOptions(select, minOrderGrams) {
    Array.from(select.options).forEach((option) => {
      const grams = Number(option.value);
      option.disabled = grams < minOrderGrams;
    });
    const firstAllowed = WEIGHTS.find((grams) => grams >= minOrderGrams) || 1000;
    select.value = String(firstAllowed);
  }

  function filterProducts(products, query, category, sort) {
    const safeQuery = normalizeQuery(query);
    const terms = safeQuery.split(" ").filter(Boolean);
    const filtered = products.filter((product) => {
      const categoryMatch = category === "All" || product.category === category;
      const haystack = normalizeQuery([
        product.name,
        product.hindiName,
        product.category,
        ...(product.tags || [])
      ].join(" "));
      const queryMatch = terms.length === 0 || terms.every((term) => haystack.includes(term));
      return categoryMatch && queryMatch;
    });
    return filtered.sort((a, b) => {
      if (sort === "price-asc") return a.pricePerKg - b.pricePerKg;
      if (sort === "price-desc") return b.pricePerKg - a.pricePerKg;
      if (sort === "az") return a.name.localeCompare(b.name);
      return Number(b.isBestseller) - Number(a.isBestseller) || a.name.localeCompare(b.name);
    });
  }

  function addToCart(productId, weightGrams, quantity) {
    const product = getProduct(productId);
    if (!product || !product.isAvailable) {
      showToast("This sweet is currently sold out.");
      return;
    }
    const weight = WEIGHTS.includes(weightGrams) ? weightGrams : Math.max(product.minOrderGrams, 250);
    const existing = state.cart.find((line) => line.productId === productId && line.weightGrams === weight);
    if (existing) {
      existing.quantity = clampQuantity(existing.quantity + quantity);
    } else {
      state.cart.push({ productId, weightGrams: weight, quantity: clampQuantity(quantity) });
    }
    saveCart();
    renderCart();
    showToast(`${product.name} added to your box.`);
    announce(`${product.name} added to cart.`);
  }

  function renderCart() {
    const lines = state.cart.map(toCartLine).filter(Boolean);
    replaceChildren(dom.cartItems, lines.map(createCartLine));
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const totalPaise = lines.reduce((sum, line) => sum + line.totalPaise, 0);
    dom.cartCount.textContent = String(itemCount);
    dom.cartTotal.textContent = money.format(totalPaise / 100);
    dom.cartEmpty.hidden = lines.length > 0;
    dom.checkoutButton.disabled = lines.length === 0;
    dom.checkoutForm.classList.toggle("is-disabled", lines.length === 0);
  }

  function createCartLine(line) {
    const item = document.createElement("article");
    item.className = "cart-line";

    const text = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = line.product.name;
    const meta = document.createElement("p");
    meta.textContent = `${formatWeight(line.weightGrams)} x ${line.quantity} - ${money.format(line.totalPaise / 100)}`;
    text.append(name, meta);

    const controls = document.createElement("div");
    controls.className = "cart-line__controls";

    const quantity = document.createElement("div");
    quantity.className = "quantity";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    minus.setAttribute("aria-label", `Decrease ${line.product.name}`);
    const value = document.createElement("span");
    value.textContent = String(line.quantity);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", `Increase ${line.product.name}`);
    quantity.append(minus, value, plus);

    const remove = document.createElement("button");
    remove.className = "cart-line__remove";
    remove.type = "button";
    remove.textContent = "Remove";

    minus.addEventListener("click", () => updateLine(line.product.id, line.weightGrams, line.quantity - 1));
    plus.addEventListener("click", () => updateLine(line.product.id, line.weightGrams, line.quantity + 1));
    remove.addEventListener("click", () => removeLine(line.product.id, line.weightGrams));

    controls.append(quantity, remove);
    item.append(text, document.createTextNode(money.format(line.linePricePaise / 100)), controls);
    return item;
  }

  function toCartLine(line) {
    const product = getProduct(line.productId);
    if (!product || !product.isAvailable) return null;
    const quantity = clampQuantity(line.quantity);
    const weightGrams = WEIGHTS.includes(Number(line.weightGrams)) ? Number(line.weightGrams) : 250;
    const totalPaise = calculateLineTotalPaise(product.pricePerKg, weightGrams, quantity);
    const linePricePaise = calculateLineTotalPaise(product.pricePerKg, weightGrams, 1);
    return { product, quantity, weightGrams, totalPaise, linePricePaise };
  }

  function updateLine(productId, weightGrams, quantity) {
    const nextQuantity = clampQuantity(quantity);
    if (quantity < 1) {
      removeLine(productId, weightGrams);
      return;
    }
    const line = state.cart.find((item) => item.productId === productId && item.weightGrams === weightGrams);
    if (line) line.quantity = nextQuantity;
    saveCart();
    renderCart();
  }

  function removeLine(productId, weightGrams) {
    state.cart = state.cart.filter((line) => !(line.productId === productId && line.weightGrams === weightGrams));
    saveCart();
    renderCart();
  }

  function loadCart() {
    const raw = state.storage.get();
    const parsed = Array.isArray(raw) ? raw : [];
    let changed = false;
    state.cart = parsed.reduce((valid, line) => {
      const product = getProduct(line.productId);
      const weightGrams = Number(line.weightGrams);
      if (!product || !product.isAvailable || !WEIGHTS.includes(weightGrams)) {
        changed = true;
        return valid;
      }
      valid.push({
        productId: product.id,
        weightGrams,
        quantity: clampQuantity(line.quantity)
      });
      return valid;
    }, []);
    if (changed) {
      showCartNotice(BAD_STORAGE_NOTICE);
      saveCart();
    }
  }

  function saveCart() {
    state.storage.set(state.cart);
  }

  function createStorage(key) {
    let memory = [];
    try {
      const testKey = `${key}-test`;
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return {
        get() {
          try {
            const value = window.localStorage.getItem(key);
            return value ? JSON.parse(value) : [];
          } catch (_error) {
            window.localStorage.removeItem(key);
            return [];
          }
        },
        set(value) {
          try {
            window.localStorage.setItem(key, JSON.stringify(value));
          } catch (_error) {
            memory = value;
          }
        }
      };
    } catch (_error) {
      return {
        get() {
          return memory;
        },
        set(value) {
          memory = value;
        }
      };
    }
  }

  function openProduct(product, trigger) {
    state.lastFocus = trigger;
    replaceChildren(dom.modalContent, [createModalContent(product)]);
    openModalElement(dom.modal, dom.modalPanel);
  }

  function createModalContent(product) {
    const wrapper = document.createElement("div");
    wrapper.className = "modal-product";

    const visual = document.createElement("div");
    visual.className = "modal-product__visual";
    visual.textContent = product.emoji;

    const details = document.createElement("div");
    const category = document.createElement("p");
    category.className = "eyebrow";
    category.textContent = product.category;
    const title = document.createElement("h2");
    title.id = "modal-title";
    title.textContent = product.name;
    const hindi = document.createElement("p");
    hindi.textContent = product.hindiName || "";
    const description = document.createElement("p");
    description.textContent = product.description;
    const price = document.createElement("p");
    price.textContent = `${money.format(product.pricePerKg)} per kg. Minimum order ${formatWeight(product.minOrderGrams)}.`;
    const tags = document.createElement("div");
    tags.className = "modal-product__tags";
    product.tags.forEach((tag) => {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = tag;
      tags.append(badge);
    });
    const button = document.createElement("button");
    button.className = "button button--primary";
    button.type = "button";
    button.textContent = product.isAvailable ? "Add 250g to Box" : "Sold Out";
    button.disabled = !product.isAvailable;
    button.addEventListener("click", () => {
      addToCart(product.id, Math.max(250, product.minOrderGrams), 1);
      closeModal();
    });
    details.append(category, title, hindi, description, price, tags, button);
    wrapper.append(visual, details);
    return wrapper;
  }

  function openLayer(type, trigger) {
    state.lastFocus = trigger;
    if (type === "cart") {
      openModalElement(dom.cartDrawer, dom.cartPanel);
    } else {
      dom.menuOpen.setAttribute("aria-expanded", "true");
      openModalElement(dom.mobileMenu, dom.mobileMenuPanel);
    }
  }

  function openModalElement(layer, panel) {
    layer.hidden = false;
    lockBody();
    requestAnimationFrame(() => panel.focus());
  }

  function closeCart() {
    closeModalElement(dom.cartDrawer);
  }

  function closeModal() {
    closeModalElement(dom.modal);
  }

  function closeMenu() {
    dom.menuOpen.setAttribute("aria-expanded", "false");
    closeModalElement(dom.mobileMenu);
  }

  function closeModalElement(layer) {
    if (layer.hidden) return;
    layer.hidden = true;
    const anyOpen = [dom.cartDrawer, dom.modal, dom.mobileMenu].some((item) => !item.hidden);
    if (!anyOpen) unlockBody();
    if (state.lastFocus && typeof state.lastFocus.focus === "function") state.lastFocus.focus();
  }

  function handleGlobalKeydown(event) {
    const openLayerElement = [dom.modal, dom.cartDrawer, dom.mobileMenu].find((layer) => !layer.hidden);
    if (!openLayerElement) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (!dom.modal.hidden) closeModal();
      else if (!dom.cartDrawer.hidden) closeCart();
      else closeMenu();
      return;
    }
    if (event.key === "Tab") trapFocus(event, openLayerElement);
  }

  function trapFocus(event, layer) {
    const focusables = Array.from(layer.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"))
      .filter((element) => element.offsetParent !== null || element === document.activeElement);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function lockBody() {
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.setProperty("--scrollbar-compensation", `${scrollbar}px`);
    document.body.classList.add("is-locked");
  }

  function unlockBody() {
    document.body.classList.remove("is-locked");
    document.body.style.removeProperty("--scrollbar-compensation");
  }

  function updateFulfillmentFields() {
    const delivery = dom.checkoutForm.fulfillment.value === "Delivery";
    dom.addressField.hidden = !delivery;
    dom.checkoutForm.address.required = delivery;
  }

  function handleCheckout(event) {
    event.preventDefault();
    if (state.submitLock) return;
    clearErrors();
    const errors = validateCheckout();
    if (errors.length) {
      errors.forEach(([name, message]) => showFieldError(name, message));
      const first = dom.checkoutForm.querySelector(`[name="${errors[0][0]}"]`);
      if (first) first.focus();
      return;
    }
    const url = buildWhatsAppUrl({
      customer: {
        name: dom.checkoutForm.name.value.trim(),
        phone: dom.checkoutForm.phone.value.trim(),
        fulfillment: dom.checkoutForm.fulfillment.value,
        address: dom.checkoutForm.address.value.trim(),
        note: dom.checkoutForm.note.value.trim()
      },
      lines: state.cart.map(toCartLine).filter(Boolean),
      totalPaise: state.cart.map(toCartLine).filter(Boolean).reduce((sum, line) => sum + line.totalPaise, 0)
    }, CONFIG);
    if (url.length > CONFIG.whatsappMaxUrlLength) {
      showFieldError("note", "Order is too long for WhatsApp. Please shorten the note or remove a few items.");
      return;
    }
    state.submitLock = true;
    dom.checkoutButton.disabled = true;
    window.open(url, "_blank", "noopener");
    setTimeout(() => {
      state.submitLock = false;
      renderCart();
    }, 1200);
  }

  function validateCheckout() {
    const errors = [];
    const lines = state.cart.map(toCartLine).filter(Boolean);
    const name = dom.checkoutForm.name.value.trim();
    const phone = dom.checkoutForm.phone.value.trim();
    const delivery = dom.checkoutForm.fulfillment.value === "Delivery";
    if (!lines.length) errors.push(["note", "Add at least one sweet before checkout."]);
    if (!name) errors.push(["name", "Please enter your name."]);
    if (!/^[6-9]\d{9}$/.test(phone)) errors.push(["phone", "Enter a valid 10-digit Indian mobile number."]);
    if (delivery && !dom.checkoutForm.address.value.trim()) errors.push(["address", "Please enter the delivery address."]);
    return errors;
  }

  function clearErrors() {
    dom.checkoutForm.querySelectorAll("[data-error-for]").forEach((item) => {
      item.textContent = "";
    });
  }

  function showFieldError(name, message) {
    const target = dom.checkoutForm.querySelector(`[data-error-for="${name}"]`);
    if (target) target.textContent = message;
  }

  function buildWhatsAppUrl(order, config = CONFIG) {
    const lines = order.lines || [];
    const note = safeString(order.customer.note).slice(0, config.noteMaxLength);
    const items = lines.map((line, index) => {
      return `${index + 1}. ${line.product.name} - ${formatWeight(line.weightGrams)} x ${line.quantity} = ${money.format(line.totalPaise / 100)}`;
    }).join("\n");
    const parts = [
      `Namaste ${config.shopName}, I would like to place an order.`,
      "",
      `Name: ${safeString(order.customer.name)}`,
      `Phone: ${safeString(order.customer.phone)}`,
      `Order type: ${safeString(order.customer.fulfillment)}`,
      order.customer.fulfillment === "Delivery" ? `Delivery address: ${safeString(order.customer.address)}` : "",
      "",
      "Items:",
      items || "No items",
      "",
      `Total: ${money.format((order.totalPaise || 0) / 100)}`,
      note ? `Note: ${note}` : ""
    ].filter(Boolean);
    return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(parts.join("\n"))}`;
  }

  function buildSimpleWhatsAppLink(message) {
    return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function updateOpenStatus() {
    if (!dom.openStatus) return;
    const status = getOpenStatus(new Date(), CONFIG.openingHours, CONFIG.timezone);
    dom.openStatus.textContent = status.valid
      ? `${status.open ? "Open now" : "Closed now"} - ${CONFIG.hoursLabel}`
      : `Hours unavailable - ${CONFIG.hoursLabel}`;
  }

  function getOpenStatus(date, hours, timezone) {
    if (!hours || !/^\d{2}:\d{2}$/.test(hours.open) || !/^\d{2}:\d{2}$/.test(hours.close)) {
      return { valid: false, open: false };
    }
    const parts = getTimeParts(date, timezone);
    const nowMinutes = parts.hour * 60 + parts.minute;
    const openMinutes = timeToMinutes(hours.open);
    const closeMinutes = timeToMinutes(hours.close);
    const isDayEnabled = hours.days.includes(parts.day);
    const previousDay = (parts.day + 6) % 7;
    if (openMinutes === closeMinutes) return { valid: true, open: isDayEnabled };
    if (openMinutes < closeMinutes) {
      return { valid: true, open: isDayEnabled && nowMinutes >= openMinutes && nowMinutes < closeMinutes };
    }
    const openToday = isDayEnabled && nowMinutes >= openMinutes;
    const stillOpenFromYesterday = hours.days.includes(previousDay) && nowMinutes < closeMinutes;
    return { valid: true, open: openToday || stillOpenFromYesterday };
  }

  function getTimeParts(date, timezone) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      day: dayMap[values.weekday],
      hour: Number(values.hour === "24" ? "0" : values.hour),
      minute: Number(values.minute)
    };
  }

  function timeToMinutes(value) {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  }

  function calculateLineTotalPaise(pricePerKg, weightGrams, quantity) {
    const paisePerKg = Math.round(Number(pricePerKg) * 100);
    return Math.round((paisePerKg * Number(weightGrams) * clampQuantity(quantity)) / 1000);
  }

  function clampQuantity(value) {
    const quantity = Number.parseInt(value, 10);
    if (!Number.isFinite(quantity) || quantity < 1) return 1;
    return Math.min(CONFIG.maxQuantity, quantity);
  }

  function normalizeQuery(value) {
    return safeString(value).toLocaleLowerCase("en-IN").replace(/\s+/g, " ").trim().slice(0, 80);
  }

  function safeString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function getProduct(productId) {
    return state.products.find((product) => product.id === productId);
  }

  function formatWeight(grams) {
    return grams >= 1000 ? `${grams / 1000}kg` : `${grams}g`;
  }

  function replaceChildren(parent, children) {
    parent.replaceChildren(...children);
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    };
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => dom.toast.classList.remove("is-visible"), 2400);
  }

  function announce(message) {
    dom.announcer.textContent = message;
  }

  function showCartNotice(message) {
    dom.cartNotice.hidden = false;
    dom.cartNotice.textContent = message;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* Offline caching is optional; the site remains fully usable without it. */
      });
    });
  }
})();
