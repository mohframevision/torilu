---
layout: base.njk
lang: "en"
permalink: "en/contact.html"
title: "Contact Us | Torilu"
description: "Contact us to request adding a restaurant, store, or place, or for any question about Torilu."
navActive: "contact"
langSwitchUrl: "/contact.html"
---
<section class="page-header">
  <h1>Contact Us</h1>
  <p>Have a restaurant, store, or place you'd like added to the site? Or have a question? Fill out the form below or email us directly.</p>
</section>

<div id="formMessage" class="form-message hidden" role="status" aria-live="polite"></div>

<form id="contactForm" class="contact-form" action="https://api.web3forms.com/submit" method="POST">
  <input type="hidden" name="access_key" value="a2dc8bb2-0fb8-47a9-8b58-ad3245d3f5a3">
  <input type="hidden" name="subject" value="New message from Torilu">
  <input type="hidden" name="from_name" value="Torilu contact form">
  <input type="checkbox" name="botcheck" class="hidden">

  <div class="form-group">
    <label for="name">Name *</label>
    <input type="text" id="name" name="name" required placeholder="Your name" minlength="2" maxlength="100" />
  </div>

  <div class="form-group">
    <label for="email">Email *</label>
    <input type="email" id="email" name="email" required placeholder="example@email.com" />
  </div>

  <div class="form-group">
    <label for="request_type">Request type</label>
    <select id="request_type" name="request_type"><option value="General inquiry">General inquiry</option>{%- for entry in sections %}{% if entry.slug != "guides" %}
<option value="Add to {{ entry.title_en }}">Add to {{ entry.title_en }}</option>{% endif %}{%- endfor %}
<option value="Suggest a story for an article">Suggest a story for an article</option>
<option value="Report incorrect info">Report incorrect info</option>
<option value="Correct a place's info">Correct a place's info</option>
<option value="Remove a place from Torilu">Remove a place from Torilu</option>
<option value="Designed menu request">Designed menu request</option></select>
  </div>

  <div class="form-group">
    <label for="message">Message *</label>
    <textarea id="message" name="message" required placeholder="Write your message here… (place name, website/maps/Instagram link if available)" minlength="5" maxlength="5000"></textarea>
  </div>

  <p id="ownerRemoveNote" class="biz-note" hidden>Before removing anything, I confirm with the business itself through the phone number or official Instagram shown on its Torilu page, not the number typed in this form, so nobody can remove a place that isn't theirs.</p>

  <button type="submit" id="submitBtn" class="btn">
    <span id="btnText">Send</span>
    <span id="btnLoading" class="hidden">Sending…</span>
  </button>
</form>

<p class="contact-direct">Or email us directly: <a href="mailto:torilu.official@gmail.com">torilu.official@gmail.com</a></p>
