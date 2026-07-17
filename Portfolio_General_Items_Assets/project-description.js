(() => {
  const path = window.location.pathname || "";
  const isAvaPage = path.includes("/Portfolio_AVA/");
  const isNeueNightPage = path.includes("/Portfolio_NeueNight/");
  const descriptionData = isAvaPage
    ? {
      body: "AVA is a modular variable typeface for the Academy of Visual Arts in Frankfurt. Built from sharp base modules, the font can shift between different expressions, making it flexible for both campaign graphics, social media and printed matter.",
      details: [
        "Designed by:<br>Michael Tsalkos",
        "Released:<br>2022",
        "Weights:<br>Variable",
        "Supports:<br>Latin",
        "Axes:<br>TRIA, STRC, EXTD",
        'Available from <a href="https://frakas.design/" target="_blank" rel="noopener noreferrer">frakas.design</a>'
      ]
    }
    : isNeueNightPage
      ? {
        body: "A transformative display sans serif created for the NIGHT JOURNEYS universe, inspired by the abstract sounds of experimental music translated into form. The typeface balances structure, texture, chaos and distortion, much like the music that frames the project.",
        details: [
          "Designed by:<br>Michael Tsalkos",
          "Weights:<br>Variable",
          "Supports:<br>Latin",
          "Axes:<br>WGHT, SPKS"
        ]
      }
    : {
      body: "Font Runners is an unusual approach to type design where running, tracking and physical movement become part of the drawing process. The letters are based on routes made by different people running glyph shapes without seeing the result. The typeface turns each route into a letterform, creating an alphabet shaped by movement, mistakes and the body.",
      details: [
        "Designed by:<br>Michael Tsalkos",
        "Released:<br>June 11, 2026",
        "Weights:<br>6",
        "Supports:<br>Latin",
        "Features:<br>SS01, SS02, SS03",
        "Licensed under SIL Open Font License"
      ]
    };

  const panel = document.createElement("aside");
  panel.className = "project-description";
  panel.innerHTML = `
    <div class="project-description-title">DESCRIPTION</div>
    <div class="project-description-content">
      <p>${descriptionData.body}</p>
      <div class="project-description-details">
        <h2 class="project-description-details-title">DETAILS</h2>
        ${descriptionData.details.map((detail) => `<div class="project-description-row">${detail}</div>`).join("")}
      </div>
    </div>
  `;

  document.body.prepend(panel);

  const content = panel.querySelector(".project-description-content");
  const measure = () => {
    panel.style.setProperty("--project-description-height", `${content.scrollHeight + 16}px`);
  };

  window.addEventListener("resize", measure);
  measure();
})();
