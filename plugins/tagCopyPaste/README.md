# Tag Copy/Paste

https://discourse.stashapp.cc/t/tagcopypaste/1858

This plugin adds Copy and Paste functionality to the Tags and Performers input fields with the goal of making it easy to copy Tags/Performers between objects, bulk load manually created lists, or load tag lists copied from AI tagger output.

Copy/Paste can be performed either with dedicated Copy/Paste buttons or by selecting the input field and performing the typical CTRL+C/CTRL+V.

Copying will create a comma delimited list of all currently entered tags/performers and put this on your clipboard.

Pasting will check your current clipboard for a comma and/or newline delimited string and add these as Tags/Performers, optionally creating any missing entries. Pasted entries will be checked against both primary names and all aliases, comparisons are not case sensitive and allow "\_" to be interpreted as a space.

Fields that only hold a single value (such as a marker's primary tag, or the merge dialogs) do not get Copy/Paste buttons.

**Note**: This plugin will prompt you to grant access to the clipboard. This must be granted in order for this plugin to work.

## Config Options:

- **Create Tags If Not Exists**: If enabled, new tags will be created when pasted list contains entries that do not already exist. DEFAULT: Disabled
- **Create Performers If Not Exists**: If enabled, new performers will be created when pasted list contains entries that do not already exist. DEFAULT: Disabled
- **Require Confirmation**: If enabled, user needs to confirm new tags/performers being created. DEFAULT: Disabled
