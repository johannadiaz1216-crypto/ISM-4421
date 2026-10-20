// Loaded in <head> without defer so the saved theme applies before first paint.
(function () {
  var theme = "system";
  try { theme = localStorage.getItem("owlweather.theme") || "system"; } catch (e) { /* ignore */ }
  if (theme !== "light" && theme !== "dark") theme = "system";
  document.documentElement.setAttribute("data-theme", theme);
})();
