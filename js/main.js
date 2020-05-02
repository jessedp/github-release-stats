const apiRoot = "https://api.github.com/";

// asset filename patterns to ignore in d/l counts
const ignores = [/yml/, /blockmap/];

// add icons by mime-type (see repo.assests.content_type)
const iconClassesByMime = {
  "mime/type": "fa? fa-proper-icon-class",
};

// add icons by file name (extension)
const iconClassesByExt = {
  appimage: "fab fa-linux",
  yml: "far fa-file-code",
  exe: "fab fa-windows",
  msi: "fab fa-windows",
  dmg: "fab fa-apple",
  rpm: "fab fa-redhat",
  deb: "fab fa-ubuntu",
};

$(document).ready(() => {
  $("#username").focus();
});

const shouldIgnore = (str) => {
  let ignore = false;
  ignores.forEach((pat) => {
    if (str.toString().match(pat)) ignore = true;
  });
  return ignore;
};

const getQueryVariable = (variable) => {
  const query = window.location.search.substring(1);
  const vars = query.split("&");
  for (let i = 0; i < vars.length; i += 1) {
    const pair = vars[i].split("=");
    if (pair[0] === variable) {
      return pair[1];
    }
  }
  return "";
};

// validate the user input
const validateInput = () => {
  if ($("#username").val().length > 0 && $("#repository").val().length > 0) {
    $("#get-stats-button").prop("disabled", false);
  } else {
    $("#get-stats-button").prop("disabled", true);
  }
};

// Callback function for getting user repositories
const getUserRepos = () => {
  const user = $("#username").val();

  const repoNames = [];

  const url = `${apiRoot}users/${user}/repos`;
  $.getJSON(url, (data) => {
    $.each(data, (index, item) => {
      repoNames.push(item.name);
    });
  });
  $("#repository").autocomplete({ source: repoNames });
};

// Display the stats
const showStats = (data) => {
  let err = false;
  let errMessage = "";

  if (data.status === 404) {
    err = true;
    errMessage = "The project does not exist!";
  }

  if (data.status === 403) {
    err = true;
    errMessage =
      "You've exceeded GitHub's rate limiting.<br />Please try again in about an hour.";
  }

  if (data.length === 0) {
    err = true;
    errMessage = "There are no releases for this project";
  }

  let html = "";

  if (err) {
    html = `<div class='col-md-8 col-md-offset-4 d-inline-block error output'>${errMessage}</div>`;
    $("#projectHead").show();
  } else {
    html += "<div class='col-md-8 offset-md-2 d-block text-left output'>";
    let latest = true;
    let totalDownloadCount = 0;
    let firstRelease = new Date();

    // Sort by publish date
    data.sort((a, b) => {
      return a.published_at < b.published_at ? 1 : -1;
    });

    $.each(data, (index, item) => {
      const releaseTag = item.tag_name;
      const releaseURL = item.html_url;
      const releaseAssets = item.assets;

      const hasAssets = releaseAssets.length > 0;
      const releaseAuthor = item.author;
      const hasAuthor = releaseAuthor != null;

      const pubDate = new Date(item.published_at);
      const publishDate = pubDate.toLocaleDateString();
      firstRelease = firstRelease > pubDate ? pubDate : firstRelease;

      let downloadInfoHTML = "<h6 class='pt-2'>No downloadable assests.</h4>";
      let ReleaseDownloadCount = 0;

      if (hasAssets) {
        downloadInfoHTML = `
                <table class="table table-sm">
                    <thead>
                        <tr>
                        <th scope="col">name</th>
                        <th scope="col">size</th>
                        <th scope="col">last update</th>
                        <th scope="col">d/l</th>
                        </tr>
                    </thead>
                    <tbody>
                    `;

        // desc
        releaseAssets.sort((a, b) => {
          return a.download_count > b.download_count ? -1 : 1;
        });

        let goodRows = "";
        let ignoreRows = "";

        $.each(releaseAssets, (idx, asset) => {
          const assetSize = (asset.size / 1048576.0)
            .toFixed(2)
            .toLocaleString();
          const lastUpdate = new Date(asset.updated_at).toLocaleDateString();

          let rowClass = "row-ignore";
          if (shouldIgnore(asset.name) === false) {
            rowClass = "row-good";
            totalDownloadCount += asset.download_count;
            ReleaseDownloadCount += asset.download_count;
          }

          const rowHTML = `
                            <tr class="${rowClass}">
                                <td>
                                <span class="${getIconClass(asset)} pr-1"/>
                                ${asset.name}
                                </td>
                                <td>${assetSize} MiB</td>
                                <td>${lastUpdate}</td>
                                <td>${asset.download_count.toLocaleString()}</td>
                            </tr>
                            `;

          if (shouldIgnore(asset.name) === false) {
            goodRows += rowHTML;
          } else {
            ignoreRows += rowHTML;
          }
        });

        downloadInfoHTML += `${goodRows}${ignoreRows}
                                     </table>`;
      }

      /* release header */
      let rowClass = "release";
      let iconClass = "fa-tag";
      if (latest && !item.prerelease) {
        rowClass = `${rowClass} latest-release`;
        latest = false;
      }
      let preText = "";
      if (item.prerelease) {
        iconClass = "fa-bomb";
        preText = '<span class="smaller">(pre-release)</span>';
      }

      html += `
        <div class='row ${rowClass} pt-2'>
            <div class='col-8 p-0'>
                <h4 >
                    <a href='${releaseURL}' target='_blank'>
                    <span class='fa ${iconClass} pr-2'></span>${releaseTag} ${preText}
                    </a>
                </h4>
            </div>
            <div class='col-4'> 
                <div class='release-dl-count'>
                <span class='fa fa-download pr-1'></span>${ReleaseDownloadCount}
                </div>
            </div>
        `;

      /* release info */
      let author;
      if (hasAuthor) {
        author = `by <a href='${releaseAuthor.html_url}'> 
                                <img class="author-img" src='${releaseAuthor.avatar_url}'/>
                                ${releaseAuthor.login}
                            </a>`;
      }
      html += `<div class="col-12">
                        <div class="author border-bottom pb-1 border-secondary">
                            <span class='fa fa-info-circle'></span> published ${publishDate} ${author}
                        </div>
                    </div>
                    `;

      /* add downloads */
      html += downloadInfoHTML;

      html += "</div>";
    });

    if (totalDownloadCount > 0) {
      totalDownloadCount = totalDownloadCount.toLocaleString();
      const totalHTML = `
                <div class='col-md-10 offset-md-1 d-block text-center total-downloads mb-3'>
                    <h2 class="mr-2">
                        <span class='fa fa-download pr-2'></span> <span class="">${totalDownloadCount}</span> Downloads
                    </h2>
                    since ${firstRelease.toLocaleDateString()} 
                </div>
                `;
      html = totalHTML + html;
    }

    html += "</div>";
  }

  const lookupDiv = $("#lookupForm");
  const resultDiv = $("#stats-result");
  resultDiv.hide();
  resultDiv.html(html);
  $("#loader-gif").hide();
  lookupDiv.hide();
  resultDiv.slideDown();
};

// Callback function for getting release stats
const getStats = () => {
  const user = $("#username").val();
  const repository = $("#repository").val();

  const url = `${apiRoot}repos/${user}/${repository}/releases`;
  $.getJSON(url, showStats).fail(showStats);
};

// The main function
$(() => {
  validateInput();
  $("#username, #repository").keyup(validateInput);

  $("#username").change(getUserRepos);

  $("#get-stats-button").click(() => {
    window.location = `?username=${$("#username").val()}&repository=${$(
      "#repository"
    ).val()}`;
  });

  $("#repository").on("keypress", (evt) => {
    if (evt.which === 13) {
      window.location = `?username=${$("#username").val()}&repository=${$(
        "#repository"
      ).val()}`;
    }
  });

  const username = getQueryVariable("username");
  const repository = getQueryVariable("repository");

  if (username !== "" && repository !== "") {
    $("#username").val(username);
    $("#repository").val(repository);
    validateInput();
    getUserRepos();
    $(".output").hide();
    $("#projectName").html(repository);
    $("#projectHead").show();
    $("#description").hide();
    $("#loader-gif").show();
    getStats();
  } else {
    $("#lookupForm").show();
  }
});

/**
 * A bunch of stuff to get a silly file icon
 */

const faIconClasses = {
  // Media
  image: "fa fa-file-image-o",
  audio: "fa fa-file-audio-o",
  video: "fa fa-file-video-o",
  // Documents
  "application/pdf": "fa fa-file-pdf-o",
  "application/msword": "fa fa-file-word-o",
  "application/vnd.ms-word": "fa fa-file-word-o",
  "application/vnd.oasis.opendocument.text": "fa fa-file-word-o",
  "application/vnd.openxmlformats-officedocument.wordprocessingml":
    "fa fa-file-word-o",
  "application/vnd.ms-excel": "fa fa-file-excel-o",
  "application/vnd.openxmlformats-officedocument.spreadsheetml":
    "fa fa-file-excel-o",
  "application/vnd.oasis.opendocument.spreadsheet": "fa fa-file-excel-o",
  "application/vnd.ms-powerpoint": "fa fa-file-powerpoint-o",
  "application/vnd.openxmlformats-officedocument.presentationml":
    "fa fa-file-powerpoint-o",
  "application/vnd.oasis.opendocument.presentation": "fa fa-file-powerpoint-o",
  "text/plain": "fa fa-file-text-o",
  "text/html": "fa fa-file-code-o",
  "application/json": "fa fa-file-code-o",
  // Archives
  "application/gzip": "far fa-file-archive",
  "application/zip": "far fa-file-archive",
  "application/x-msdos-program": "fab fa-windows", // fab
};

function getIconClass(asset) {
  const mimeType = asset.content_type;
  if (!mimeType || typeof mimeType !== "string") {
    return false;
  }

  if (iconClassesByMime[mimeType]) return iconClassesByMime[mimeType];
  // check built-in ones...
  if (faIconClasses[mimeType]) return faIconClasses[mimeType];

  // get the extension and check it
  const extension = asset.name.split(".").pop().toLowerCase();

  if (!extension) {
    return false;
  }

  if (iconClassesByExt[extension]) return iconClassesByExt[extension];
  console.warn("Unable to find icon: ", asset.name, asset.content_type);
  return "far fa-file";
}
