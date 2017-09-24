$(document).ready(function() {
        $('.sidebar-nav a').click(function(e) {
        e.preventDefault();

        toggleSidebarTab(this)
    });
});

function closeSidebar() {
    let icons = $('.sidebar-nav a');
    for (let i = 0; i < icons.length; i++) {
        let icon = icons[i];
        if ($(icon).parent().hasClass( "active" )) {
            toggleSidebarTab(icon)
        }
    }
}

function toggleSidebarTab(tab) {
    let wrapper = $("#wrapper");
    let thisElement = $(tab);

    // When the side bar is opened and to be closed
    if (wrapper.hasClass("toggled")) {
        wrapper.bind('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend', function() {
            $(thisElement.data("target")).find(".sidebar-content").toggleClass("content-transition");

            // Remove class active from the selected element
            thisElement.parent().toggleClass("active");

            // Mark the end of the stransition
            wrapper.toggleClass("transition");

            // Hide the title of selected element
            $(thisElement.data("target")).find(".sidebar-content-title").toggleClass("title-active");

            // Unbind transitionend listener
            wrapper.unbind('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend');
        });
    }
    // When the side bar is closed and to be opened
    else {
        // Add class active from the selected element
        thisElement.parent().toggleClass("active");

        // Display the title of selected element
        $(thisElement.data("target")).find(".sidebar-content-title").toggleClass("title-active");

        wrapper.bind('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend', function() {
            $(thisElement.data("target")).find(".sidebar-content").toggleClass("content-transition");

            // Mark the end of the stransition
            wrapper.toggleClass("transition");

            // Unbind transitionend listener
            wrapper.unbind('webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend');
        });
    }

    // Toggle target annotations content content
    $(thisElement.data("target")).find(".sidebar-content").toggleClass("content-active");

    // Mark the start of the stransition and toggle annotations
    wrapper.toggleClass("transition");
    wrapper.toggleClass("toggled");
}
