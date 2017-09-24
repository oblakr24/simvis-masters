/**
 * Created by rokoblak on 7/18/17.
 */

app.directive("meshingModal", function () {
    return {
        restrict: 'E',
        replace: true,
        scope: false,
        link: function (scope, modal, attributes) {

            // Make modal draggable
            modal.draggable({
                handle: ".modal-header"
            });

            // DOM references
            let meshingModal = modal;
            let createMeshButton = meshingModal.find("#createMeshButton");
            let tooltipWrapper = createMeshButton.closest(".tooltip-wrapper");

            // Enable tooltip
            meshingModal.find('[data-toggle="tooltip"]').tooltip();
            meshingModal.find('[data-toggle="popover"]').popover();

            // // Toggles load button and its tooltip
            let toggleLoadButton = function(state) {
                createMeshButton.prop('disabled', !state);
                tooltipWrapper.tooltip(state ? 'disable' : 'enable');
            };

            scope.$watch('edgeSize', function(newValue, oldValue) {
                toggleLoadButton(newValue > 0);
            });

            createMeshButton.click(function() {
                scope.meshModel();
                modal.modal('hide');
            });
        },
        templateUrl: "app/components/html/meshingModal.html"
    }
});