(async () => {
  const PluginApi = window.PluginApi;
  const React = PluginApi.React;

  let pluginSettings = {};
  const defaultPluginSettings = {
    createIfNotExists: false,
    createPerformersIfNotExists: false,
    requireConfirmation: false,
  };

  const TAG_FIELDS = `id, name, sort_name, favorite, description, aliases, image_path, parents {id, name}, stash_ids {endpoint, stash_id, updated_at }`;
  const PERFORMER_FIELDS = `id, name, disambiguation, alias_list, image_path, birthdate, death_date`;

  // Per-entity configuration. Tags and Performers share the copy/paste logic,
  // they only differ in the GQL calls and the sort order.
  const entityTypes = {
    tag: {
      component: "TagSelect",
      className: "tagCopyPaste",
      createSetting: "createIfNotExists",
      label: "Tags",
      find: findTagsByName,
      create: createNewTag,
      sort: (entityArray) =>
        entityArray.sort((a, b) => {
          var aCompStr = a.sort_name ? a.sort_name : a.name;
          var bCompStr = b.sort_name ? b.sort_name : b.name;
          return aCompStr.localeCompare(bCompStr);
        }),
    },
    performer: {
      component: "PerformerSelect",
      className: "performerCopyPaste",
      createSetting: "createPerformersIfNotExists",
      label: "Performers",
      find: findPerformersByName,
      create: createNewPerformer,
      sort: (entityArray) =>
        entityArray.sort((a, b) => a.name.localeCompare(b.name)),
    },
  };

  // Helper functions for handling array of entities.
  const getNameArray = (entityArray) => entityArray.map((value) => value.name);
  const getNameString = (entityArray) => getNameArray(entityArray).join(", ");

  async function setupCopyPaste() {
    // Get plugin settings.
    const configSettings = await csLib.getConfiguration("tagCopyPaste", {}); // getConfiguration is from cs-ui-lib.js
    pluginSettings = {
      ...defaultPluginSettings,
      ...configSettings,
    };

    for (const entityType of Object.values(entityTypes)) {
      patchSelect(entityType);
    }
  }

  // Patch a *Select component to add copy/paste buttons.
  function patchSelect(entityType) {
    PluginApi.patch.after(
      entityType.component,
      function (props, _, originalComponent) {
        const copyButtonRef = React.useRef(null);
        const pasteButtonRef = React.useRef(null);
        const propsRef = props;

        // Copy Button click handler
        const copyClickHandler = (event) => {
          event.preventDefault();
          handleCopyClick(propsRef.values ?? []);
        };

        // Paste Button click handler
        const pasteClickHandler = (event) => {
          event.preventDefault();
          handlePasteClick(entityType, propsRef.onSelect, propsRef.values ?? []);
        };

        React.useEffect(() => {
          // Not the ideal way to handle this, but it works.
          // Wait for the buttons to render and then add the onCopy/onPaste handlers to select control DOM element.
          if (copyButtonRef && copyButtonRef.current) {
            var mainCopyPasteWrapper =
              copyButtonRef.current.parentElement.parentElement;
            var inputBox = mainCopyPasteWrapper.querySelector(
              ".react-select__value-container",
            );

            const copyEventHandler = (e) => {
              e.preventDefault();
              copyButtonRef.current.click();
            };

            const pasteEventHandler = (e) => {
              e.preventDefault();
              pasteButtonRef.current.click();
            };

            if (inputBox) {
              inputBox.addEventListener("copy", copyEventHandler);
              inputBox.addEventListener("paste", pasteEventHandler);
            }
          }
        }, []);

        // Selects that only hold a single value (merge dialogs, a marker's
        // primary tag) have nothing useful to paste a list into.
        if (props.isMulti === false) return originalComponent;

        return React.createElement(
          "div",
          { className: `csCopyPaste ${entityType.className}` },
          [
            React.createElement(
              "div",
              {
                className: "btn-group",
              },
              [
                React.createElement(
                  "button",
                  {
                    type: "button",
                    ref: copyButtonRef,
                    onClick: copyClickHandler,
                    className:
                      "imageGalleryNav-copyButton btn btn-secondary btn-sm",
                  },
                  "Copy",
                ),
                React.createElement(
                  "button",
                  {
                    type: "button",
                    ref: pasteButtonRef,
                    onClick: pasteClickHandler,
                    className:
                      "imageGalleryNav-pasteButton btn btn-secondary btn-sm",
                  },
                  "Paste",
                ),
              ],
            ),
            originalComponent,
          ],
        );
      },
    );
  }

  // Handle copy click. Return delimited list of current entries.
  async function handleCopyClick(propValues) {
    // Get entries from input box
    // join as comma delimited list
    navigator.clipboard.writeText(getNameString(propValues));
  }

  // Handle paste click.
  async function handlePasteClick(entityType, onSelect, propValues) {
    // Parse list from comma and/or newline delimited string.
    const input = await navigator.clipboard.readText();
    var inputNameList = input
      .split(/\r?\n|\r|,/)
      .map((s) => s.trim())
      .filter((text) => text !== ""); // do de-duplication later

    // Get entries from input box and also add to the list.
    const existingNameList = getNameArray(propValues);

    inputNameList = [...new Set([...inputNameList, ...existingNameList])].sort();

    var missingNames = [];
    var updateList = [];

    // Look up each name. If it exists, add it to the update list. If not, remember it for creation.
    for (const inputName of inputNameList) {
      const matches = await entityType.find(inputName);
      if (matches && matches.length) {
        updateList.push(matches[0]);
      } else {
        missingNames.push(inputName);
      }
    }

    // Create missing entries if enabled. Prompt user to confirm if confirmation option is also enabled.
    const missingStr = missingNames.join(", ");
    const msg = `Missing ${entityType.label} that will be created:\n${missingStr}\n\nContinue?`;
    if (
      pluginSettings[entityType.createSetting] &&
      missingNames.length &&
      (!pluginSettings.requireConfirmation || confirm(msg))
    ) {
      for (const missingName of missingNames) {
        const created = await entityType.create(missingName);
        if (created != null) updateList.push(created);
      }
    }

    // Update the Select control with the new list.
    onSelect(entityType.sort(updateList));
  }

  // *** GQL Calls ***

  // Create new tag.
  // Return newly created tag object.
  async function createNewTag(tagName) {
    const variables = { input: { name: tagName } };
    const query = `mutation CreateTag($input:TagCreateInput!) { tagCreate(input: $input) { ${TAG_FIELDS} } }`;
    return await csLib
      .callGQL({ query, variables })
      .then((data) => data.tagCreate);
  }

  // Find Tag by name/alias.
  // Return matched list of tag objects.
  async function findTagsByName(tagName) {
    const tagFilter = {
      name: { value: tagName, modifier: "EQUALS" },
      OR: { aliases: { value: tagName, modifier: "EQUALS" } },
    };
    const findFilter = { per_page: -1, sort: "name" };
    const variables = { tag_filter: tagFilter, filter: findFilter };
    const query = `query ($tag_filter: TagFilterType!, $filter: FindFilterType!) { findTags(filter: $filter, tag_filter: $tag_filter) { tags { ${TAG_FIELDS} } } }`;
    return await csLib
      .callGQL({ query, variables })
      .then((data) => data.findTags.tags);
  }

  // Create new performer.
  // Return newly created performer object.
  async function createNewPerformer(performerName) {
    const variables = { input: { name: performerName } };
    const query = `mutation CreatePerformer($input:PerformerCreateInput!) { performerCreate(input: $input) { ${PERFORMER_FIELDS} } }`;
    return await csLib
      .callGQL({ query, variables })
      .then((data) => data.performerCreate);
  }

  // Find Performer by name/alias.
  // Return matched list of performer objects.
  async function findPerformersByName(performerName) {
    const performerFilter = {
      name: { value: performerName, modifier: "EQUALS" },
      OR: { aliases: { value: performerName, modifier: "EQUALS" } },
    };
    const findFilter = { per_page: -1, sort: "name" };
    const variables = { performer_filter: performerFilter, filter: findFilter };
    const query = `query ($performer_filter: PerformerFilterType!, $filter: FindFilterType!) { findPerformers(filter: $filter, performer_filter: $performer_filter) { performers { ${PERFORMER_FIELDS} } } }`;
    return await csLib
      .callGQL({ query, variables })
      .then((data) => data.findPerformers.performers);
  }

  setupCopyPaste();
})();
