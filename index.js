(() => {
  const unpatches = [];
  const state = {
    spoofAdmin: true,
    debugLog: "Ready (v3)"
  };

  const getV = () => window.vendetta || {};

  const PERM_FLAGS = [
    ["Administrator", 1n << 3n],
    ["Manage Server", 1n << 5n],
    ["Manage Roles", 1n << 28n],
    ["Manage Channels", 1n << 4n],
    ["Kick Members", 1n << 1n],
    ["Ban Members", 1n << 2n],
    ["Manage Messages", 1n << 13n],
    ["View Audit Log", 1n << 7n],
    ["Manage Webhooks", 1n << 29n],
    ["Moderate Members", 1n << 40n]
  ];

  const ALL_PERMS = (1n << 46n) - 1n;

  const decodePerms = (raw) => {
    try {
      const p = BigInt(raw ?? 0);
      const out = [];
      for (const [label, bit] of PERM_FLAGS) {
        if ((p & bit) === bit) out.push(label);
      }
      return out.length ? out.join(" • ") : "Member / Basic";
    } catch {
      return "N/A";
    }
  };

  const copyText = (text, label) => {
    const v = getV();
    try {
      v.metro?.common?.clipboard?.setString?.(String(text));
      v.ui?.toasts?.showToast?.(`Copied ${label}`);
    } catch {}
  };

  const openNativeGuildSettings = (guildId) => {
    const v = getV();
    try {
      const SelectedGuildStore = v.metro?.findByStoreName?.("SelectedGuildStore");
      const id = guildId || SelectedGuildStore?.getGuildId?.();
      if (!id) {
        v.ui?.toasts?.showToast?.("Enter any server first!");
        return;
      }

      const mod1 = v.metro?.findByProps?.("openGuildSettings");
      if (mod1?.openGuildSettings) {
        mod1.openGuildSettings(id);
        return;
      }

      const mod2 = v.metro?.findByProps?.("transitionToGuildSettings");
      if (mod2?.transitionToGuildSettings) {
        mod2.transitionToGuildSettings(id);
        return;
      }

      const nav = v.metro?.findByProps?.("transitionTo");
      if (nav?.transitionTo) {
        nav.transitionTo(`/guilds/${id}/settings`);
        return;
      }

      v.ui?.toasts?.showToast?.("Tap server name -> Settings");
    } catch (e) {
      v.ui?.toasts?.showToast?.("Error opening native settings");
    }
  };

  const setupPatches = () => {
    const v = getV();
    const { metro, patcher, commands } = v;
    if (!metro || !patcher) return;

    // 1. Spoof PermissionStore methods for local view-only access
    const PermStore = metro.findByStoreName?.("PermissionStore") || metro.findByProps?.("getGuildPermissions", "can");
    if (PermStore) {
      if (typeof PermStore.can === "function") {
        unpatches.push(
          patcher.instead("can", PermStore, function (args, orig) {
            if (state.spoofAdmin) return true;
            return orig.apply(this, args);
          })
        );
      }
      if (typeof PermStore.canAccessGuildSettings === "function") {
        unpatches.push(
          patcher.instead("canAccessGuildSettings", PermStore, function (args, orig) {
            if (state.spoofAdmin) return true;
            return orig.apply(this, args);
          })
        );
      }
      if (typeof PermStore.getGuildPermissions === "function") {
        unpatches.push(
          patcher.after("getGuildPermissions", PermStore, function (_, res) {
            if (!state.spoofAdmin) return res;
            return typeof res === "bigint" ? ALL_PERMS : Number.MAX_SAFE_INTEGER;
          })
        );
      }
      state.debugLog = "PermissionStore patched";
    }

    // 2. Register /inspect command as a guaranteed trigger inside any server
    if (commands?.registerCommand) {
      try {
        const unreg = commands.registerCommand({
          name: "inspect",
          displayName: "inspect",
          description: "Open Server Settings & Inspector for current server",
          displayDescription: "Open Server Settings & Inspector for current server",
          options: [],
          applicationId: "-1",
          inputType: 1,
          type: 1,
          execute: (_, ctx) => {
            const gid = ctx?.guild?.id;
            openNativeGuildSettings(gid);
          }
        });
        if (typeof unreg === "function") unpatches.push(unreg);
      } catch {}
    }
  };

  function SettingsComponent() {
    const v = getV();
    const React = v.metro?.common?.React;
    const RN = v.metro?.common?.ReactNative;

    if (!React || !RN) return null;

    const { ScrollView, View, Text, Pressable } = RN;
    const [, tick] = React.useState(0);

    const SelectedGuildStore = v.metro?.findByStoreName?.("SelectedGuildStore");
    const GuildStore = v.metro?.findByStoreName?.("GuildStore");
    const UserStore = v.metro?.findByStoreName?.("UserStore");

    const guildId = SelectedGuildStore?.getGuildId?.();
    const guild = guildId ? GuildStore?.getGuild?.(guildId) : null;
    const owner = guild?.ownerId ? UserStore?.getUser?.(guild.ownerId) : null;

    const roles = guild?.roles
      ? Object.values(guild.roles).sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
      : [];

    const cardStyle = {
      backgroundColor: "#1E1F22",
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "#2B2D31"
    };

    const btnStyle = (bg) => ({
      backgroundColor: bg,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 10,
      alignItems: "center"
    });

    return React.createElement(
      ScrollView,
      { style: { flex: 1, backgroundColor: "#111214", padding: 14 } },

      // Header Banner
      React.createElement(
        View,
        { style: cardStyle },
        React.createElement(
          Text,
          { style: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold", marginBottom: 4 } },
          "ServerInspector v3"
        ),
        React.createElement(
          Text,
          { style: { color: "#B5BAC1", fontSize: 13 } },
          `Status: ${state.debugLog} • Spoof: ${state.spoofAdmin ? "ACTIVE" : "OFF"}`
        )
      ),

      // Toggle Spoof Button
      React.createElement(
        Pressable,
        {
          style: btnStyle(state.spoofAdmin ? "#248046" : "#4E5058"),
          onPress: () => {
            state.spoofAdmin = !state.spoofAdmin;
            tick((x) => x + 1);
            v.ui?.toasts?.showToast?.(`Admin Spoof: ${state.spoofAdmin ? "ON" : "OFF"}`);
          }
        },
        React.createElement(
          Text,
          { style: { color: "#FFFFFF", fontWeight: "bold", fontSize: 15 } },
          state.spoofAdmin ? "Admin Permission Spoof: ENABLED (Tap to Disable)" : "Admin Permission Spoof: DISABLED (Tap to Enable)"
        )
      ),

      // Open Native Server Settings Button
      React.createElement(
        Pressable,
        {
          style: btnStyle("#5865F2"),
          onPress: () => openNativeGuildSettings(guildId)
        },
        React.createElement(
          Text,
          { style: { color: "#FFFFFF", fontWeight: "bold", fontSize: 15 } },
          guild ? `Open Server Settings (${guild.name})` : "Open Native Server Settings"
        )
      ),

      // Server Details Card
      guild
        ? React.createElement(
            View,
            { style: cardStyle },
            React.createElement(
              Text,
              { style: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold", marginBottom: 8 } },
              "Current Server Overview"
            ),
            React.createElement(
              Text,
              { style: { color: "#DBDEE1", fontSize: 13, marginBottom: 4 } },
              `Name: ${guild.name}`
            ),
            React.createElement(
              Pressable,
              { onPress: () => copyText(guild.id, "Server ID") },
              React.createElement(
                Text,
                { style: { color: "#00A8FC", fontSize: 13, marginBottom: 4 } },
                `ID: ${guild.id} (Tap to copy)`
              )
            ),
            React.createElement(
              Text,
              { style: { color: "#DBDEE1", fontSize: 13, marginBottom: 4 } },
              `Owner: ${owner ? owner.username : "Unknown"} (${guild.ownerId || "N/A"})`
            ),
            React.createElement(
              Text,
              { style: { color: "#DBDEE1", fontSize: 13 } },
              `Total Roles: ${roles.length} • Boost Level: ${guild.premiumTier ?? 0}`
            )
          )
        : React.createElement(
            View,
            { style: cardStyle },
            React.createElement(
              Text,
              { style: { color: "#B5BAC1", fontSize: 13 } },
              "No server active right now. Enter any server first, then open Settings here or tap the server header."
            )
          ),

      // Roles & Permissions Inspector
      guild && roles.length > 0
        ? React.createElement(
            View,
            { style: cardStyle },
            React.createElement(
              Text,
              { style: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold", marginBottom: 10 } },
              `Roles & Permissions (${roles.length})`
            ),
            ...roles.map((r) =>
              React.createElement(
                Pressable,
                {
                  key: r.id,
                  onPress: () => copyText(`${r.name} (${r.id}): ${decodePerms(r.permissions)}`, "Role Details"),
                  style: {
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: "#2B2D31"
                  }
                },
                React.createElement(
                  Text,
                  { style: { color: "#FFFFFF", fontWeight: "bold", fontSize: 14 } },
                  `${r.name}  [Pos: ${r.position ?? 0}]`
                ),
                React.createElement(
                  Text,
                  { style: { color: "#949BA4", fontSize: 12, marginTop: 2 } },
                  decodePerms(r.permissions)
                )
              )
            )
          )
        : null,

      React.createElement(View, { style: { height: 40 } })
    );
  }

  return {
    onLoad() {
      try {
        setupPatches();
      } catch (e) {
        state.debugLog = "onLoad err: " + String(e);
      }
    },
    onUnload() {
      while (unpatches.length) {
        try {
          const fn = unpatches.pop();
          if (typeof fn === "function") fn();
        } catch {}
      }
    },
    settings: SettingsComponent
  };
})();
