import type { ConversionOpportunityPlan, MarketingStrategy, ProductResearch, VideoAnalysis } from "@/lib/types";

type ThemeFile = { filename: string; body: { type: "TEXT"; value: string } };

function safe(v: unknown, fallback = "") {
  return String(v ?? fallback).slice(0, 5000);
}

function jsonTemplate(value: unknown) {
  return JSON.stringify(value);
}

function enhanceMainProductSection(section: any, research: ProductResearch, strategy: MarketingStrategy) {
  const copy = structuredClone(section || {});
  const blocks = copy.blocks;
  const order: string[] = Array.isArray(copy.block_order) ? [...copy.block_order] : [];
  if (!blocks || typeof blocks !== "object") return copy;
  const types = Object.values(blocks).map((block: any) => block?.type);
  const looksLikeShrine = types.includes("sticky_atc") || types.includes("rating_stars") || types.includes("shipping_checkpoints");
  if (!looksLikeShrine) return copy;

  const remove = new Set<string>();
  for (const [id, block] of Object.entries(blocks) as [string, any][]) {
    if (block?.type === "shipping_checkpoints") remove.add(id);
    if (block?.type === "rating_stars" && String(block?.settings?.label || "").toLowerCase().includes("xxxx")) remove.add(id);
    if (block?.type === "reviews") {
      const serialized = JSON.stringify(block?.settings || {}).toLowerCase();
      if (serialized.includes("share positive thoughts") || serialized.includes('"author"')) remove.add(id);
    }
    if (block?.type === "collapsible_tab" && String(block?.settings?.heading || "").toLowerCase() === "collapsible row") remove.add(id);
    if (block?.type === "quantity_selector" && block?.settings?.enable_quantity_discounts === false && String(block?.settings?.headline || "").toUpperCase().includes("BUNDLE")) remove.add(id);
    if (block?.type === "variant_picker") {
      const optionLabel = research.variantOptionName ? research.variantOptionName.toLowerCase() : "option";
      block.settings = { ...(block.settings || {}), picker_types: "pills", custom_labels: `Choose your ${optionLabel} · [selected]`, swatches_size: "large" };
    }
    if (block?.type === "buy_buttons") block.settings = { ...(block.settings || {}), display_price: true, show_dynamic_checkout: false };
    if (block?.type === "sticky_atc") block.settings = { ...(block.settings || {}), button_label: strategy.ctaLabel || "Add to cart" };
  }
  for (const id of remove) delete blocks[id];
  copy.block_order = order.filter((id) => !remove.has(id));

  const benefits = strategy.benefitBullets.filter(Boolean).slice(0, 3);
  if (benefits.length) {
    const id = "storeforge_benefits";
    blocks[id] = {
      type: "text",
      settings: {
        mobile_text_size: 14,
        desktop_text_size: 15,
        alignment: "left",
        text_color: "#171513",
        text_1: benefits[0] || "",
        text_2: benefits[1] || "",
        text_3: benefits[2] || "",
        icon_scale: 120,
        icon_color: "#171513",
        icon_1: "check_circle",
        filled_icon_1: true,
        icon_2: "check_circle",
        filled_icon_2: true,
        icon_3: "check_circle",
        filled_icon_3: true,
        width: "100%",
        direction: "vertical",
        column_gap: 1.5,
        enable_bg: true,
        bg_color: "#f8f4ef",
        corner_radius: 20,
        padding: 2,
        border_size: 0,
        border_color: "#b7b7b7",
        margin_top: 12,
        margin_bottom: 15,
      },
    };
    const titleIndex = copy.block_order.findIndex((blockId: string) => blocks[blockId]?.type === "title");
    copy.block_order.splice(titleIndex >= 0 ? titleIndex + 1 : 0, 0, id);
  }
  return copy;
}

export function buildStoreForgeThemeFiles(args: {
  productTemplate: any;
  research: ProductResearch;
  strategy: MarketingStrategy;
  videos: VideoAnalysis[];
  videoUrls: string[];
  imageUrls: string[];
  priceLabel: string;
  compareAtLabel?: string;
  saleBadge?: string;
  productHandle?: string;
  operationalNote?: string;
  supportEmail?: string;
  conversionPlan?: ConversionOpportunityPlan;
}): ThemeFile[] {
  const { productTemplate, research, strategy, videos, videoUrls, imageUrls, priceLabel, compareAtLabel = "", saleBadge = "", productHandle, operationalNote = "", supportEmail = "", conversionPlan } = args;
  const presentation = { density: "balanced", heroScale: "default", mediaFit: "cover", mobileVideoWidth: 78, ...(strategy.presentation || {}) };
  const sectionPad = presentation.density === "compact" ? 4 : presentation.density === "spacious" ? 7 : 5.5;
  const sectionPadMobile = presentation.density === "compact" ? 3 : presentation.density === "spacious" ? 5 : 4;
  const heroDesktopMax = presentation.heroScale === "smaller" ? 5.8 : 7;
  const heroMobileMax = presentation.heroScale === "smaller" ? 4.6 : 5.4;
  const mobileVideoWidth = [72, 78, 84].includes(Number(presentation.mobileVideoWidth)) ? Number(presentation.mobileVideoWidth) : 78;
  const mediaFit = presentation.mediaFit === "contain" ? "contain" : "cover";
  const home = `{% assign featured_product = section.settings.product %}
<section class="sf-home">
  {% if section.settings.offer != blank %}<div class="sf-offer">{{ section.settings.offer }}</div>{% endif %}
  <div class="page-width sf-hero">
    <div class="sf-copy">
      <p class="sf-kicker">{{ section.settings.kicker }}</p>
      <h1>{{ section.settings.heading }}</h1>
      <p class="sf-sub">{{ section.settings.subheading }}</p>
      <ul class="sf-benefits">
        {% if section.settings.benefit_1 != blank %}<li>{{ section.settings.benefit_1 }}</li>{% endif %}
        {% if section.settings.benefit_2 != blank %}<li>{{ section.settings.benefit_2 }}</li>{% endif %}
        {% if section.settings.benefit_3 != blank %}<li>{{ section.settings.benefit_3 }}</li>{% endif %}
        {% if section.settings.benefit_4 != blank %}<li>{{ section.settings.benefit_4 }}</li>{% endif %}
      </ul>
      {% if section.settings.price_text != blank %}<div class="sf-price"><strong>{{ section.settings.price_text }}</strong>{% if section.settings.compare_price_text != blank %}<s>{{ section.settings.compare_price_text }}</s>{% endif %}{% if section.settings.sale_badge != blank %}<span>{{ section.settings.sale_badge }}</span>{% endif %}</div>{% endif %}
      <a class="button button--primary sf-cta" href="{{ featured_product.url | default: section.settings.product_url }}">{{ section.settings.cta }}</a>
      {% if section.settings.note != blank %}<p class="sf-note">{{ section.settings.note }}</p>{% endif %}
    </div>
    <div class="sf-media">
      {% if section.settings.image_url != blank %}<img src="{{ section.settings.image_url }}" alt="{{ section.settings.image_alt | escape }}" width="1000" height="1250" loading="eager">{% endif %}
    </div>
  </div>
  <div class="sf-proofbar"><span>{{ section.settings.strip_1 }}</span><span>{{ section.settings.strip_2 }}</span><span>{{ section.settings.strip_3 }}</span><span>{{ section.settings.strip_4 }}</span></div>
  <div class="page-width sf-story">
    <div><p class="sf-kicker">{{ section.settings.story_kicker }}</p><h2>{{ section.settings.story_heading }}</h2><p>{{ section.settings.story_text }}</p></div>
    {% if section.settings.story_image_url != blank %}<img src="{{ section.settings.story_image_url }}" alt="{{ section.settings.story_image_alt | escape }}" width="1000" height="1250" loading="lazy">{% endif %}
  </div>
  <div class="sf-dark"><div class="page-width"><p class="sf-kicker">{{ section.settings.cards_kicker }}</p><h2>{{ section.settings.cards_heading }}</h2><div class="sf-cards">{% for block in section.blocks %}<article {{ block.shopify_attributes }}><b>0{{ forloop.index }}</b><h3>{{ block.settings.title }}</h3><p>{{ block.settings.text }}</p></article>{% endfor %}</div></div></div>
  <div class="page-width sf-final"><h2>{{ section.settings.final_heading }}</h2><p>{{ section.settings.final_text }}</p><a class="button button--primary sf-cta" href="{{ featured_product.url | default: section.settings.product_url }}">{{ section.settings.cta }}</a></div>
</section>
{% stylesheet %}
.sf-home{background:#f8f4ef;color:#171513}.sf-offer{background:#171513;color:#fff;text-align:center;padding:12px 16px;font-size:12px;font-weight:800;letter-spacing:.12em}.sf-hero,.sf-story{display:grid;grid-template-columns:1fr 1fr;gap:5rem;align-items:center;padding-top:${sectionPad}rem;padding-bottom:${sectionPad}rem}.sf-copy h1,.sf-home h2{line-height:.98;letter-spacing:-.045em;margin:0 0 2rem}.sf-copy h1{font-size:clamp(4rem,6vw,${heroDesktopMax}rem)}.sf-home h2{font-size:clamp(3.2rem,4.5vw,5.4rem)}.sf-kicker{font-size:1.2rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase;margin:0 0 1.2rem}.sf-sub,.sf-story p,.sf-cards p,.sf-final p{font-size:1.65rem;line-height:1.6}.sf-benefits{list-style:none;padding:0;margin:2rem 0}.sf-benefits li{padding:.8rem 0;border-bottom:1px solid #d8d0c8}.sf-benefits li:before{content:"✓";font-weight:900;margin-right:.8rem}.sf-price{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin:2rem 0}.sf-price strong{font-size:2.8rem;font-weight:900}.sf-price s{font-size:1.5rem;opacity:.55}.sf-price span{background:#dffb8b;color:#171513;border-radius:999px;padding:.7rem 1rem;font-size:1.1rem;font-weight:900}.sf-cta{min-width:22rem}.sf-note{font-size:1.2rem;opacity:.68;margin-top:1rem}.sf-media img,.sf-story img{width:100%;height:auto;display:block;border-radius:2rem}.sf-proofbar{display:flex;gap:3rem;justify-content:space-around;white-space:nowrap;overflow:hidden;background:#fff;border-block:1px solid #ddd4ca;padding:1.6rem;font-size:1.1rem;font-weight:900;letter-spacing:.1em}.sf-dark{background:#171513;color:#fff;padding:${sectionPad}rem 0}.sf-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;margin-top:3rem}.sf-cards article{background:#29241f;padding:2.5rem;border-radius:1.8rem}.sf-cards article b{opacity:.55}.sf-cards h3{font-size:2.2rem}.sf-final{text-align:center;padding-top:${sectionPad}rem;padding-bottom:${sectionPad}rem}.sf-final p{max-width:70rem;margin:0 auto 2rem}@media(max-width:749px){.sf-hero,.sf-story{grid-template-columns:1fr;gap:2.5rem;padding-top:${sectionPadMobile}rem;padding-bottom:${sectionPadMobile}rem}.sf-media{order:-1}.sf-cards{grid-template-columns:1fr}.sf-proofbar{justify-content:flex-start}.sf-copy h1{font-size:clamp(3.6rem,13vw,${heroMobileMax}rem)}}
{% endstylesheet %}
{% schema %}
{"name":"StoreForge conversion home","settings":[{"type":"product","id":"product","label":"Product"},{"type":"url","id":"product_url","label":"Product URL fallback"},{"type":"text","id":"offer","label":"Offer bar"},{"type":"text","id":"kicker","label":"Hero kicker"},{"type":"textarea","id":"heading","label":"Hero heading"},{"type":"textarea","id":"subheading","label":"Hero subheading"},{"type":"text","id":"benefit_1","label":"Benefit 1"},{"type":"text","id":"benefit_2","label":"Benefit 2"},{"type":"text","id":"benefit_3","label":"Benefit 3"},{"type":"text","id":"benefit_4","label":"Benefit 4"},{"type":"text","id":"price_text","label":"Price text"},{"type":"text","id":"compare_price_text","label":"Compare-at text"},{"type":"text","id":"sale_badge","label":"Sale badge"},{"type":"text","id":"cta","label":"CTA"},{"type":"text","id":"note","label":"Under CTA note"},{"type":"url","id":"image_url","label":"Hero image URL"},{"type":"text","id":"image_alt","label":"Hero image alt"},{"type":"text","id":"strip_1","label":"Proof strip 1"},{"type":"text","id":"strip_2","label":"Proof strip 2"},{"type":"text","id":"strip_3","label":"Proof strip 3"},{"type":"text","id":"strip_4","label":"Proof strip 4"},{"type":"text","id":"story_kicker","label":"Story kicker"},{"type":"textarea","id":"story_heading","label":"Story heading"},{"type":"textarea","id":"story_text","label":"Story text"},{"type":"url","id":"story_image_url","label":"Story image URL"},{"type":"text","id":"story_image_alt","label":"Story image alt"},{"type":"text","id":"cards_kicker","label":"Cards kicker"},{"type":"textarea","id":"cards_heading","label":"Cards heading"},{"type":"textarea","id":"final_heading","label":"Final heading"},{"type":"textarea","id":"final_text","label":"Final text"}],"blocks":[{"type":"benefit","name":"Benefit card","settings":[{"type":"text","id":"title","label":"Title"},{"type":"textarea","id":"text","label":"Text"}]}],"max_blocks":3,"presets":[{"name":"StoreForge conversion home"}]}
{% endschema %}`;

  const ugc = `<section class="sf-ugc"><div class="page-width"><p class="sf-u-kicker">{{ section.settings.kicker }}</p><h2>{{ section.settings.heading }}</h2><p class="sf-u-intro">{{ section.settings.intro }}</p><div class="sf-u-rail">{% for block in section.blocks %}<article class="sf-u-card" {{ block.shopify_attributes }}><div class="sf-u-video">{% if block.settings.video_url contains 'tiktok.com/player/' %}<iframe src="{{ block.settings.video_url }}" title="{{ block.settings.title | escape }}" loading="lazy" allow="fullscreen; autoplay; encrypted-media" allowfullscreen></iframe>{% elsif block.settings.video_url != blank %}<video playsinline preload="metadata" {% if forloop.first %}muted autoplay loop{% else %}controls{% endif %} {% if block.settings.poster_url != blank %}poster="{{ block.settings.poster_url }}"{% endif %}><source src="{{ block.settings.video_url }}" type="video/mp4"></video>{% endif %}</div><div class="sf-u-copy"><span>{{ block.settings.label }}</span><h3>{{ block.settings.title }}</h3><p>{{ block.settings.text }}</p></div></article>{% endfor %}</div></div></section>
{% stylesheet %}.sf-ugc{background:#fff;padding:${sectionPad}rem 0}.sf-u-kicker{font-size:1.2rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.sf-ugc h2{font-size:clamp(3.2rem,4vw,5.2rem);letter-spacing:-.04em;margin:.5rem 0 1rem}.sf-u-intro{font-size:1.6rem;max-width:70rem;line-height:1.55}.sf-u-rail{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(24rem,29rem);gap:1.5rem;overflow-x:auto;scroll-snap-type:x mandatory;padding:2.5rem 0 1rem}.sf-u-card{scroll-snap-align:start;background:#f7f3ef;border-radius:1.8rem;overflow:hidden}.sf-u-video{aspect-ratio:9/16;background:#111}.sf-u-video video,.sf-u-video iframe{width:100%;height:100%;display:block;border:0}.sf-u-video video{object-fit:${mediaFit}}.sf-u-copy{padding:1.5rem}.sf-u-copy span{font-size:1.1rem;font-weight:900;letter-spacing:.1em}.sf-u-copy h3{font-size:2rem;margin:.5rem 0}.sf-u-copy p{font-size:1.4rem;line-height:1.5;margin:0}@media(max-width:749px){.sf-ugc{padding:${sectionPadMobile}rem 0}.sf-u-rail{grid-auto-columns:${mobileVideoWidth}vw}}{% endstylesheet %}
{% schema %}{"name":"StoreForge UGC proof","settings":[{"type":"text","id":"kicker","label":"Kicker"},{"type":"textarea","id":"heading","label":"Heading"},{"type":"textarea","id":"intro","label":"Intro"}],"blocks":[{"type":"video","name":"UGC video","settings":[{"type":"url","id":"video_url","label":"Shopify MP4 or TikTok player URL"},{"type":"url","id":"poster_url","label":"Poster URL"},{"type":"text","id":"label","label":"Eyebrow"},{"type":"text","id":"title","label":"Title"},{"type":"textarea","id":"text","label":"Text"}]}],"max_blocks":10,"presets":[{"name":"StoreForge UGC proof"}]}{% endschema %}`;

  const story = `<section class="sf-pdp"><div class="page-width sf-pdp-grid"><div><p class="sf-p-kicker">{{ section.settings.kicker }}</p><h2>{{ section.settings.heading }}</h2><p>{{ section.settings.text }}</p><ul>{% for block in section.blocks %}{% if block.type == 'benefit' %}<li {{ block.shopify_attributes }}><strong>{{ block.settings.title }}</strong> {{ block.settings.text }}</li>{% endif %}{% endfor %}</ul></div>{% if section.settings.image_url != blank %}<img src="{{ section.settings.image_url }}" alt="{{ section.settings.image_alt | escape }}" width="1000" height="1250" loading="lazy">{% endif %}</div><div class="sf-pdp-dark"><div class="page-width"><p class="sf-p-kicker">{{ section.settings.faq_kicker }}</p><h2>{{ section.settings.faq_heading }}</h2><div class="sf-faq">{% for block in section.blocks %}{% if block.type == 'faq' %}<details {{ block.shopify_attributes }}><summary>{{ block.settings.question }}</summary><p>{{ block.settings.answer }}</p></details>{% endif %}{% endfor %}</div></div></div><div class="page-width sf-pdp-final"><h2>{{ section.settings.final_heading }}</h2><p>{{ section.settings.final_text }}</p><a class="button button--primary" href="#MainProduct-template">{{ section.settings.cta }}</a></div></section>
{% stylesheet %}.sf-pdp{background:#f8f4ef;color:#171513}.sf-pdp-grid{display:grid;grid-template-columns:1fr 1fr;gap:5rem;align-items:center;padding-top:${sectionPad}rem;padding-bottom:${sectionPad}rem}.sf-pdp-grid img{width:100%;height:auto;border-radius:2rem}.sf-p-kicker{font-size:1.2rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.sf-pdp h2{font-size:clamp(3.2rem,4.3vw,5.4rem);line-height:1;letter-spacing:-.04em;margin:.6rem 0 1.8rem}.sf-pdp p,.sf-pdp li{font-size:1.65rem;line-height:1.6}.sf-pdp li{padding:.6rem 0}.sf-pdp-dark{background:#171513;color:#fff;padding:${sectionPad}rem 0}.sf-faq{max-width:90rem}.sf-faq details{border-top:1px solid #514943;padding:2rem 0}.sf-faq summary{cursor:pointer;font-size:1.9rem;font-weight:900}.sf-pdp-final{text-align:center;padding-top:${sectionPad}rem;padding-bottom:${sectionPad}rem}.sf-pdp-final p{max-width:70rem;margin:0 auto 2rem}@media(max-width:749px){.sf-pdp-grid{grid-template-columns:1fr;gap:2.5rem;padding-top:${sectionPadMobile}rem;padding-bottom:${sectionPadMobile}rem}}{% endstylesheet %}
{% schema %}{"name":"StoreForge product story","settings":[{"type":"text","id":"kicker","label":"Kicker"},{"type":"textarea","id":"heading","label":"Heading"},{"type":"textarea","id":"text","label":"Text"},{"type":"url","id":"image_url","label":"Image URL"},{"type":"text","id":"image_alt","label":"Image alt"},{"type":"text","id":"faq_kicker","label":"FAQ kicker"},{"type":"textarea","id":"faq_heading","label":"FAQ heading"},{"type":"textarea","id":"final_heading","label":"Final heading"},{"type":"textarea","id":"final_text","label":"Final text"},{"type":"text","id":"cta","label":"CTA"}],"blocks":[{"type":"benefit","name":"Benefit","settings":[{"type":"text","id":"title","label":"Title"},{"type":"textarea","id":"text","label":"Text"}]},{"type":"faq","name":"FAQ","settings":[{"type":"text","id":"question","label":"Question"},{"type":"textarea","id":"answer","label":"Answer"}]}],"max_blocks":12,"presets":[{"name":"StoreForge product story"}]}{% endschema %}`;

  const proof = `<section class="sf-proof"><div class="page-width"><p class="sf-pr-kicker">{{ section.settings.kicker }}</p><h2>{{ section.settings.heading }}</h2><div class="sf-pr-grid">{% for block in section.blocks %}<figure {{ block.shopify_attributes }}><div class="sf-pr-stars">★★★★★</div><blockquote>“{{ block.settings.quote }}”</blockquote><figcaption>{{ block.settings.source }}</figcaption></figure>{% endfor %}</div>{% if section.settings.note != blank %}<p class="sf-pr-note">{{ section.settings.note }}</p>{% endif %}</div></section>
{% stylesheet %}.sf-proof{background:#f8f4ef;padding:${sectionPad}rem 0}.sf-pr-kicker{font-size:1.2rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.sf-proof h2{font-size:clamp(3rem,4vw,5rem);letter-spacing:-.04em}.sf-pr-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1.5rem}.sf-pr-grid figure{margin:0;background:#fff;padding:2.4rem;border-radius:1.8rem}.sf-pr-stars{letter-spacing:.14em}.sf-pr-grid blockquote{font-size:1.8rem;line-height:1.5;margin:1rem 0}.sf-pr-grid figcaption,.sf-pr-note{font-size:1.2rem;opacity:.68}@media(max-width:749px){.sf-pr-grid{grid-template-columns:1fr}}{% endstylesheet %}
{% schema %}{"name":"StoreForge social proof","settings":[{"type":"text","id":"kicker","label":"Kicker"},{"type":"textarea","id":"heading","label":"Heading"},{"type":"textarea","id":"note","label":"Source note"}],"blocks":[{"type":"quote","name":"Verified proof","settings":[{"type":"textarea","id":"quote","label":"Quote"},{"type":"text","id":"source","label":"Source"}]}],"max_blocks":6,"presets":[{"name":"StoreForge social proof"}]}{% endschema %}`;

  const comparison = `<section class="sf-compare"><div class="page-width"><p class="sf-c-kicker">{{ section.settings.kicker }}</p><h2>{{ section.settings.heading }}</h2><div class="sf-c-table" role="table" aria-label="{{ section.settings.heading | escape }}"><div class="sf-c-row sf-c-head" role="row"><div role="columnheader">{{ section.settings.attribute_label }}</div><div role="columnheader">{{ section.settings.product_label }}</div><div role="columnheader">{{ section.settings.alternative_label }}</div></div>{% for block in section.blocks %}<div class="sf-c-row" role="row" {{ block.shopify_attributes }}><div role="cell"><strong>{{ block.settings.attribute }}</strong></div><div role="cell">{{ block.settings.product }}</div><div role="cell">{{ block.settings.alternative }}</div></div>{% endfor %}</div>{% if section.settings.note != blank %}<p class="sf-c-note">{{ section.settings.note }}</p>{% endif %}</div></section>
{% stylesheet %}.sf-compare{background:#fff;padding:${sectionPad}rem 0}.sf-c-kicker{font-size:1.2rem;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.sf-compare h2{font-size:clamp(3rem,4vw,5rem);letter-spacing:-.04em;margin:.5rem 0 2.5rem}.sf-c-table{border:1px solid #e2d9d0;border-radius:1.8rem;overflow:hidden}.sf-c-row{display:grid;grid-template-columns:1.1fr 1fr 1fr;border-top:1px solid #e2d9d0}.sf-c-row:first-child{border-top:0}.sf-c-row>div{padding:1.6rem}.sf-c-head{background:#171513;color:#fff;font-weight:900}.sf-c-row:not(.sf-c-head)>div:nth-child(2){background:#f8f4ef}.sf-c-note{font-size:1.2rem;opacity:.65;margin-top:1.4rem}@media(max-width:749px){.sf-compare{padding:${sectionPadMobile}rem 0}.sf-c-row{grid-template-columns:.9fr 1fr 1fr;font-size:1.2rem}.sf-c-row>div{padding:1rem .7rem}}{% endstylesheet %}
{% schema %}{"name":"StoreForge comparison","settings":[{"type":"text","id":"kicker","label":"Kicker"},{"type":"textarea","id":"heading","label":"Heading"},{"type":"text","id":"attribute_label","label":"Attribute label"},{"type":"text","id":"product_label","label":"Product label"},{"type":"text","id":"alternative_label","label":"Alternative label"},{"type":"textarea","id":"note","label":"Comparison note"}],"blocks":[{"type":"row","name":"Comparison row","settings":[{"type":"text","id":"attribute","label":"Attribute"},{"type":"textarea","id":"product","label":"Product"},{"type":"textarea","id":"alternative","label":"Alternative"}]}],"max_blocks":8,"presets":[{"name":"StoreForge comparison"}]}{% endschema %}`;


  const opportunities = `<section class="sf-opps"><div class="page-width"><div class="sf-o-head"><p class="sf-o-kicker">{{ section.settings.kicker }}</p><h2>{{ section.settings.heading }}</h2>{% if section.settings.intro != blank %}<p>{{ section.settings.intro }}</p>{% endif %}</div><div class="sf-o-list">{% for block in section.blocks %}<article class="sf-o-card sf-o-card--{{ block.settings.style }}" {{ block.shopify_attributes }}><div class="sf-o-copy">{% if block.settings.kicker != blank %}<p class="sf-o-kicker">{{ block.settings.kicker }}</p>{% endif %}<h3>{{ block.settings.heading }}</h3>{% if block.settings.body != blank %}<p>{{ block.settings.body }}</p>{% endif %}{% if block.settings.bullet_1 != blank or block.settings.bullet_2 != blank or block.settings.bullet_3 != blank or block.settings.bullet_4 != blank %}<ul>{% if block.settings.bullet_1 != blank %}<li>{{ block.settings.bullet_1 }}</li>{% endif %}{% if block.settings.bullet_2 != blank %}<li>{{ block.settings.bullet_2 }}</li>{% endif %}{% if block.settings.bullet_3 != blank %}<li>{{ block.settings.bullet_3 }}</li>{% endif %}{% if block.settings.bullet_4 != blank %}<li>{{ block.settings.bullet_4 }}</li>{% endif %}</ul>{% endif %}</div>{% if block.settings.image_url != blank %}<img src="{{ block.settings.image_url }}" alt="{{ block.settings.image_alt | escape }}" width="1000" height="1000" loading="lazy">{% endif %}</article>{% endfor %}</div></div></section>
{% stylesheet %}.sf-opps{background:#f8f4ef;padding:${sectionPad}rem 0}.sf-o-head{max-width:78rem;margin-bottom:2.5rem}.sf-o-head h2{font-size:clamp(3rem,4.2vw,5.2rem);line-height:1;letter-spacing:-.04em;margin:.5rem 0 1.2rem}.sf-o-head>p:last-child{font-size:1.6rem;line-height:1.6}.sf-o-kicker{font-size:1.1rem!important;font-weight:900;letter-spacing:.14em;text-transform:uppercase;margin:0 0 .8rem!important}.sf-o-list{display:grid;gap:1.6rem}.sf-o-card{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:3rem;align-items:center;background:#fff;border:1px solid #e3dbd3;border-radius:2rem;padding:2.4rem;overflow:hidden}.sf-o-card:nth-child(even){background:#171513;color:#fff}.sf-o-card:nth-child(even) img{order:-1}.sf-o-card h3{font-size:clamp(2.4rem,3vw,3.8rem);line-height:1.05;letter-spacing:-.035em;margin:.4rem 0 1rem}.sf-o-card p,.sf-o-card li{font-size:1.5rem;line-height:1.6}.sf-o-card ul{padding-left:2rem;margin:1.5rem 0 0}.sf-o-card img{width:100%;height:auto;aspect-ratio:1/1;object-fit:${mediaFit};border-radius:1.5rem}.sf-o-card--text{grid-template-columns:1fr}.sf-o-card--text img{display:none}@media(max-width:749px){.sf-opps{padding:${sectionPadMobile}rem 0}.sf-o-card{grid-template-columns:1fr;gap:1.8rem;padding:1.8rem}.sf-o-card:nth-child(even) img{order:0}.sf-o-card h3{font-size:2.8rem}}{% endstylesheet %}
{% schema %}{"name":"StoreForge optimizer modules","settings":[{"type":"text","id":"kicker","label":"Kicker"},{"type":"textarea","id":"heading","label":"Heading"},{"type":"textarea","id":"intro","label":"Intro"}],"blocks":[{"type":"module","name":"Conversion module","settings":[{"type":"select","id":"style","label":"Layout","options":[{"value":"split","label":"Image + text"},{"value":"text","label":"Text only"}],"default":"split"},{"type":"text","id":"kicker","label":"Kicker"},{"type":"textarea","id":"heading","label":"Heading"},{"type":"textarea","id":"body","label":"Body"},{"type":"text","id":"bullet_1","label":"Bullet 1"},{"type":"text","id":"bullet_2","label":"Bullet 2"},{"type":"text","id":"bullet_3","label":"Bullet 3"},{"type":"text","id":"bullet_4","label":"Bullet 4"},{"type":"url","id":"image_url","label":"Image URL"},{"type":"text","id":"image_alt","label":"Image alt text"}]}],"max_blocks":8,"presets":[{"name":"StoreForge optimizer modules"}]}{% endschema %}`;

  const heroImage = imageUrls[0] || "";
  const storyImage = imageUrls[1] || heroImage;
  const benefits = [...strategy.benefitBullets, ...research.benefits].filter(Boolean).slice(0, 4);
  while (benefits.length < 4) benefits.push("");
  const cards = strategy.benefitBullets.slice(0, 3).map((benefit, i) => ({
    type: "benefit",
    settings: { title: benefit.split(/[:.]/)[0] || `Benefit ${i + 1}`, text: benefit },
  }));
  const homeBlocks: Record<string, any> = {};
  const homeOrder: string[] = [];
  cards.forEach((b, i) => { const id = `benefit_${i + 1}`; homeBlocks[id] = b; homeOrder.push(id); });

  const ugcBlocks: Record<string, any> = {};
  const ugcOrder: string[] = [];
  videos.forEach((video, i) => {
    const id = `video_${i + 1}`;
    ugcOrder.push(id);
    ugcBlocks[id] = { type: "video", settings: { video_url: videoUrls[i] || video.embedUrl || "", poster_url: video.posterUrl || "", label: video.angle, title: video.hook, text: video.bestStoreUse } };
  });

  const proofBlocks: Record<string, any> = {};
  const proofOrder: string[] = [];
  strategy.socialProof.slice(0, 6).forEach((item, i) => { const id = `quote_${i + 1}`; proofBlocks[id] = { type: "quote", settings: item }; proofOrder.push(id); });

  const comparisonBlocks: Record<string, any> = {};
  const comparisonOrder: string[] = [];
  strategy.comparisonRows.slice(0, 8).forEach((row, i) => {
    const id = `row_${i + 1}`;
    comparisonBlocks[id] = { type: "row", settings: { attribute: safe(row.attribute), product: safe(row.product), alternative: safe(row.alternative) } };
    comparisonOrder.push(id);
  });


  const includedModules = (conversionPlan?.modules || []).filter((module) => module.status === "include").sort((a, b) => b.priority - a.priority);
  function opportunityGroup(placement: "after_ugc" | "mid_page" | "before_faq") {
    const selected = includedModules.filter((module) => module.placement === placement).slice(0, 8);
    const blocks: Record<string, any> = {};
    const block_order: string[] = [];
    selected.forEach((module, i) => {
      const id = `module_${placement}_${i + 1}`;
      block_order.push(id);
      const bullets = module.bullets.slice(0, 4);
      blocks[id] = { type: "module", settings: { style: imageUrls.length ? "split" : "text", kicker: safe(module.kicker), heading: safe(module.heading || module.title), body: safe(module.body), bullet_1: safe(bullets[0]), bullet_2: safe(bullets[1]), bullet_3: safe(bullets[2]), bullet_4: safe(bullets[3]), image_url: imageUrls[(i + (placement === "after_ugc" ? 2 : placement === "mid_page" ? 3 : 4)) % Math.max(imageUrls.length, 1)] || "", image_alt: safe(research.productName) } };
    });
    return { blocks, block_order };
  }
  const opportunityEarly = opportunityGroup("after_ugc");
  const opportunityMid = opportunityGroup("mid_page");
  const opportunityLate = opportunityGroup("before_faq");

  const storyBlocks: Record<string, any> = {};
  const storyOrder: string[] = [];
  strategy.benefitBullets.slice(0, 4).forEach((item, i) => { const id = `benefit_${i + 1}`; storyBlocks[id] = { type: "benefit", settings: { title: item.split(/[:.]/)[0], text: item } }; storyOrder.push(id); });
  strategy.faq.slice(0, 6).forEach((item, i) => { const id = `faq_${i + 1}`; storyBlocks[id] = { type: "faq", settings: item }; storyOrder.push(id); });
  if (supportEmail && storyOrder.length < 12) {
    const id = "faq_support";
    storyBlocks[id] = { type: "faq", settings: { question: "Need help before ordering?", answer: `Contact ${supportEmail} and we’ll help with product questions.` } };
    storyOrder.push(id);
  }

  const homeTemplate = {
    sections: {
      storeforge_home: { type: "storeforge-home", blocks: homeBlocks, block_order: homeOrder, settings: {
        product: productHandle || "", product_url: productHandle ? `/products/${productHandle}` : "", offer: saleBadge, kicker: safe(strategy.heroKicker), heading: safe(strategy.heroHeading), subheading: safe(strategy.heroSubheading),
        benefit_1: benefits[0], benefit_2: benefits[1], benefit_3: benefits[2], benefit_4: benefits[3], price_text: priceLabel, compare_price_text: compareAtLabel, sale_badge: saleBadge, cta: safe(strategy.ctaLabel), note: safe(operationalNote),
        image_url: heroImage, image_alt: safe(research.productName), strip_1: benefits[0], strip_2: benefits[1], strip_3: benefits[2], strip_4: "Watch real creator demos",
        story_kicker: "WHY IT WORKS", story_heading: safe(strategy.storyHeadline), story_text: safe(strategy.positioning), story_image_url: storyImage, story_image_alt: safe(research.productName),
        cards_kicker: "WHY SHOPPERS GET IT", cards_heading: safe(strategy.proofHeadline), final_heading: safe(strategy.heroHeading), final_text: safe(strategy.heroSubheading),
      } },
      storeforge_ugc: { type: "storeforge-ugc", blocks: ugcBlocks, block_order: ugcOrder, settings: { kicker: "WATCH IT IN ACTION", heading: safe(strategy.proofHeadline), intro: "Real creator footage gives shoppers proof before they buy." } },
      storeforge_proof: { type: "storeforge-proof", blocks: proofBlocks, block_order: proofOrder, settings: { kicker: "SOCIAL PROOF", heading: "What shoppers are saying", note: strategy.socialProof.length ? "Only verified or source-backed proof should be published." : "No unverified testimonials are shown." } },
      storeforge_compare: { type: "storeforge-comparison", blocks: comparisonBlocks, block_order: comparisonOrder, settings: { kicker: "WHY THIS FORMAT", heading: safe(strategy.comparisonTitle), attribute_label: "", product_label: safe(research.productName), alternative_label: "Typical alternative", note: "Comparisons should stay factual and product-specific." } },
    },
    order: ["storeforge_home", "storeforge_ugc", "storeforge_proof", "storeforge_compare"],
  };

  const productBase = structuredClone(productTemplate || { sections: {}, order: [] });
  const sections = productBase.sections || {};
  const order: string[] = Array.isArray(productBase.order) ? [...productBase.order] : [];
  const mainId = order[0] || Object.keys(sections)[0] || "main";
  const mainSection = enhanceMainProductSection(sections[mainId] || { type: "main-product", settings: {} }, research, strategy);
  const productTemplateOut = {
    sections: {
      [mainId]: mainSection,
      storeforge_ugc: { type: "storeforge-ugc", blocks: ugcBlocks, block_order: ugcOrder, settings: { kicker: "REAL CREATOR DEMOS", heading: safe(strategy.proofHeadline), intro: "Tap to watch the product in use." } },
      ...(opportunityEarly.block_order.length ? { storeforge_opportunities_early: { type: "storeforge-opportunities", blocks: opportunityEarly.blocks, block_order: opportunityEarly.block_order, settings: { kicker: "SHOP WITH CONFIDENCE", heading: "The details that make the decision easier.", intro: "Only product-specific, supportable information is included." } } } : {}),
      storeforge_proof: { type: "storeforge-proof", blocks: proofBlocks, block_order: proofOrder, settings: { kicker: "SOCIAL PROOF", heading: "Proof before purchase", note: strategy.socialProof.length ? "Source-backed proof only." : "No unverified testimonials are shown." } },
      storeforge_compare: { type: "storeforge-comparison", blocks: comparisonBlocks, block_order: comparisonOrder, settings: { kicker: "COMPARE THE ROUTINE", heading: safe(strategy.comparisonTitle), attribute_label: "", product_label: safe(research.productName), alternative_label: "Typical alternative", note: "Comparisons should stay factual and product-specific." } },
      ...(opportunityMid.block_order.length ? { storeforge_opportunities_mid: { type: "storeforge-opportunities", blocks: opportunityMid.blocks, block_order: opportunityMid.block_order, settings: { kicker: "KNOW THE PRODUCT", heading: "Everything useful before you decide.", intro: "StoreForge adds detail only when it reduces a real buying objection." } } } : {}),
      ...(opportunityLate.block_order.length ? { storeforge_opportunities_late: { type: "storeforge-opportunities", blocks: opportunityLate.blocks, block_order: opportunityLate.block_order, settings: { kicker: "BEFORE YOU ORDER", heading: "A few final details worth knowing.", intro: "Operational promises appear only when they were supplied by the merchant." } } } : {}),
      storeforge_story: { type: "storeforge-story", blocks: storyBlocks, block_order: storyOrder, settings: { kicker: "WHY IT'S DIFFERENT", heading: safe(strategy.storyHeadline), text: safe(strategy.positioning), image_url: storyImage, image_alt: safe(research.productName), faq_kicker: "QUESTIONS, ANSWERED", faq_heading: "Everything to know before ordering", final_heading: safe(strategy.heroHeading), final_text: safe(strategy.heroSubheading), cta: safe(strategy.ctaLabel) } },
    },
    order: [mainId, "storeforge_ugc", ...(opportunityEarly.block_order.length ? ["storeforge_opportunities_early"] : []), "storeforge_proof", "storeforge_compare", ...(opportunityMid.block_order.length ? ["storeforge_opportunities_mid"] : []), ...(opportunityLate.block_order.length ? ["storeforge_opportunities_late"] : []), "storeforge_story"],
  };

  return [
    { filename: "sections/storeforge-home.liquid", body: { type: "TEXT", value: home } },
    { filename: "sections/storeforge-ugc.liquid", body: { type: "TEXT", value: ugc } },
    { filename: "sections/storeforge-proof.liquid", body: { type: "TEXT", value: proof } },
    { filename: "sections/storeforge-comparison.liquid", body: { type: "TEXT", value: comparison } },
    { filename: "sections/storeforge-opportunities.liquid", body: { type: "TEXT", value: opportunities } },
    { filename: "sections/storeforge-story.liquid", body: { type: "TEXT", value: story } },
    { filename: "templates/index.json", body: { type: "TEXT", value: jsonTemplate(homeTemplate) } },
    { filename: "templates/product.json", body: { type: "TEXT", value: jsonTemplate(productTemplateOut) } },
  ];
}
