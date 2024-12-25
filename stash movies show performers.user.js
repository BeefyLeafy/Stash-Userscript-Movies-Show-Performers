// ==UserScript==
// @name         Stash Movie Show Performers
// @namespace    https://github.com/BeefyLeafy
// @version      1.1.0
// @description  Stash show performers on Groups (Movies) page. Image tooltip for performers on multiple movie cards pages.
// @author       BeefyLeafy
// @match        http://localhost:9999/*
// @icon         http://localhost:9999/favicon.ico
// @require      https://raw.githubusercontent.com/BeefyLeafy/Tooltips/master/Tooltips.min.js
// @require      https://raw.githubusercontent.com/BeefyLeafy/stash-userscripts/refs/heads/master/src/StashUserscriptLibrary.js
// @grant        GM_addStyle
// ==/UserScript==


(function() {
    'use strict';

    // Change your endpont based on your ip and port of Stash accordingly (You may also need to change the @match url)
    const GRAPHQL_ENDPOINT = "http://localhost:9999/graphql";
    // Stash userscript helper, Credit to https://github.com/7dJx1qP/stash-userscripts/blob/master/src/StashUserscriptLibrary.js
    const { stash, getElementByXpath, waitForElementClass } = unsafeWindow.stash;
    // TooltipHelper minified, from https://github.com/BeefyLeafy/Tooltips/blob/master/Tooltips.min.js, Orignial credit to https://github.com/CreativeTechGuy/Tooltips
    const tooltipHelper = new TooltipHelper();
    // Add css
    GM_addStyle(`
                 .group-card-performer {color : #C4B1A5}
                 .group-card-performer a {font-weight: bold; color: #CCBCB2}
                 custom-tooltip img {width: 150px}
                 .detail-item-title.block {display: block !important}
                 .group-performer-img-container {width: 100px; display: inline-block; margin-top: 10px; margin-right:20px}
                 .group-performer-img-container .img-link {display: block; position: relative; width: 100%; text-decoration: none}
                 .img-link img {width: 100%; height: auto}
                 .img-link .img-caption {position: absolute; bottom: 0; left: 0; right: 0; background-color: rgba(0,0,0,0.5);
                     color: rgb(232, 230, 227); text-align: center; padding: 5px; box-sizing: border-box}
                 `);
    // Helper function, takes the scenes object from GQL result, at least have performers, and performers at least have id and name as fields
    const getUniquePerformersFromScenes = (scenes) => {
        const allPerformers = scenes.flatMap(scene => scene.performers);
        // Remove duplicates by creating a map based on performer ID
        const uniquePerformers = Array.from(new Map(allPerformers.map(performer => [performer.id, performer])).values());
        return uniquePerformers;
    };
    // Function that contains the main logic for all movies page
    const setGroupsPerformers = async () => {
        await waitForElementClass("group-card-header", () => {
            const groupIDs = [...document.querySelectorAll("a.group-card-header")].map(elem => elem.href.match(/groups\/([0-9]+)/)[1]);

            stash.callGQL({"query":`{findGroups(ids:[${groupIDs}]) {groups {id, scenes {performers {id, name} } } } }`})
                .then(json => {
                const groups = json.data.findGroups.groups;
                groups.forEach(group => {
                    const uniquePerformers = getUniquePerformersFromScenes(group.scenes);
                    const groupTitleElem = getElementByXpath(`//a[@href='/groups/${group.id}' and not(contains(@class, 'group-card-header'))]`);
                    // Skip the logic if the next element of groupTitle is already added (class name "group-card-performer")
                    if (groupTitleElem.nextSibling.className === "group-card-performer") {
                        return;
                    }
                    if (uniquePerformers.length > 0) {
                        const groupPerformersDiv = document.createElement("div");
                        groupPerformersDiv.className = "group-card-performer";
                        groupPerformersDiv.appendChild(document.createTextNode("With "));
                        uniquePerformers.forEach((performer, idx) => {
                            const performerElem = document.createElement('a');
                            performerElem.href = `/performers/${performer.id}`;
                            performerElem.text = performer.name;
                            groupPerformersDiv.appendChild(performerElem);
                            // Add a comma if this is not the last element
                            if (idx < uniquePerformers.length - 1) {
                                groupPerformersDiv.appendChild(document.createTextNode(', '));
                            }
                            // Insert the groupPerformersDiv after the group title element
                            groupTitleElem.after(groupPerformersDiv);
                            // Create performer image tooltip
                            const performerImage = document.createElement("img");
                            performerImage.src = `/performer/${performer.id}/image`;
                            tooltipHelper.setTooltip(performerElem, performerImage);
                        });
                    }
                });
            })
                .catch(err => console.log(err));
        });
    };
    // Function that contains all the logic for the movie detials page (single movie)
    const setSingleGroupPerformers = async () => {
        await waitForElementClass("detail-group", () => {
            const groupID = new URL(window.location.href).pathname.match(/groups\/([0-9]+)/)[1];
            // Skip logic if already added performers div
            if (document.querySelector(".detail-item.performers")) {
                return;
            }

            stash.callGQL({"query":`{findGroups(ids:[${groupID}]) {groups {scenes {performers {id, name} } } } }`})
                .then(json => {
                const uniquePerformers = getUniquePerformersFromScenes(json.data.findGroups.groups[0].scenes);
                if (uniquePerformers.length > 0) {
                    const detailDiv = document.querySelector(".detail-group");
                    const wrapperDiv = document.createElement("div");
                    wrapperDiv.className = "detail-item performers";
                    // Append performer text span
                    const performerSpan = document.createElement("span");
                    performerSpan.innerText = "Performer" + (uniquePerformers.length > 1 ? "s" : "") + ":";
                    performerSpan.className = "detail-item-title block";
                    wrapperDiv.appendChild(performerSpan);
                    uniquePerformers.forEach(performer => {
                        // Append performer images (image links in the div)
                        const imageDiv = document.createElement("div");
                        imageDiv.className = "group-performer-img-container";
                        const image = document.createElement("img");
                        image.src = `/performer/${performer.id}/image`;
                        const aLink = document.createElement("a");
                        aLink.className = "img-link";
                        aLink.href = `/performers/${performer.id}`;
                        const nameSpan = document.createElement("span");
                        nameSpan.className = "img-caption";
                        nameSpan.innerText = performer.name;
                        aLink.appendChild(image);
                        aLink.appendChild(nameSpan);
                        imageDiv.appendChild(aLink);
                        wrapperDiv.appendChild(imageDiv);
                    });
                    detailDiv.appendChild(wrapperDiv);
                }
            })
                .catch(err => console.log(err));
        });
    };

    stash.addEventListener('page:groups', setGroupsPerformers);
    stash.addEventListener('page:performer:groups', setGroupsPerformers);
    stash.addEventListener('page:studio:groups', setGroupsPerformers);
    stash.addEventListener('page:group:scenes', setSingleGroupPerformers);
    stash.addEventListener('page:group', setSingleGroupPerformers);
})();