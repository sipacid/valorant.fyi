// main.js — wiring only. Everything else lives in the files loaded before this
// one; see the script block in index.html for the load order.

(function (VF) {
  "use strict";

  const startButton = VF.qs("#start");
  const agentsButton = VF.qs("#agents-button");
  const challengesButton = VF.qs("#challenges-button");
  const muteButton = VF.qs("#mute-button");

  // The old markup used onclick="start()", which only worked because everything
  // was a true global. It isn't any more.
  if (startButton) startButton.addEventListener("click", VF.spin.start);
  if (agentsButton) agentsButton.addEventListener("click", VF.agentPool.open);
  if (challengesButton) {
    challengesButton.addEventListener("click", () =>
      VF.challenges.open({ agent: VF.spin.getLastAgent() }),
    );
  }

  if (muteButton) {
    const syncMuteButton = () => {
      const muted = VF.audio.isMuted();
      muteButton.textContent = muted ? "SFX OFF" : "SFX ON";
      muteButton.classList.toggle("is-muted", muted);
      muteButton.setAttribute("aria-pressed", String(!muted));
    };
    muteButton.addEventListener("click", () => {
      VF.audio.setMuted(!VF.audio.isMuted());
      syncMuteButton();
    });
    syncMuteButton();
  }

  VF.agentPool.onChange(VF.spin.syncStartAvailability);
  VF.spin.syncStartAvailability(VF.agentPool.getIncluded());

  VF.atmosphere.preloadAgentImages();
  VF.atmosphere.createTacticalBackground();
  VF.atmosphere.createParticles();

  VF.challenges.init();
})(window.VF);
