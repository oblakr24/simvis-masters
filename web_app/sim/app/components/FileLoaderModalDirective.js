/**
 * Created by rokoblak on 7/18/17.
 */


app.directive("fileLoaderModal", function () {
    return {
        restrict: 'E',
        replace: true,
        scope: false,
        link: function (scope, modal, attributes) {

            // Make modal draggable
            modal.draggable({
                handle: ".modal-header"
            });

            let isSelectedLocal = true;

            // fetch the existing models
            scope.listExistingModels();

            // DOM references
            let objLoaderModal = modal;
            let objFileOpenButton = objLoaderModal.find("#objFileOpenButton");
            let objButtonTooltipWrapper = objFileOpenButton.closest(".tooltip-wrapper");
            let objFileInput = objLoaderModal.find("#objFileInput");
            // File input styling
            objFileInput.filestyle({buttonName: "btn-danger", buttonText: "&nbspChoose .obj file", size: "sm"});

            // Enable tooltip
            objLoaderModal.find('[data-toggle="tooltip"]').tooltip();
            objLoaderModal.find('[data-toggle="popover"]').popover();

            // Toggles load button and its tooltip
            let toggleLoadButton = function(state) {
                objFileOpenButton.prop('disabled', !state);
                objButtonTooltipWrapper.tooltip(state ? 'disable' : 'enable');
            };

            // Function used to validate and unlock load button
            let validateLoadButton = function() {
                if (isSelectedLocal) {
                    toggleLoadButton(objFileInput.val() !== "");
                } else {
                    toggleLoadButton(scope.selectedModel.length > 0);
                }

            };

            // Re-validate on input change
            objFileInput.change(validateLoadButton);

            objFileOpenButton.click(function() {
                if (isSelectedLocal) {
                    let objFile = objFileInput.prop('files')[0];
                    scope.uploadModel(objFile);
                } else {
                    scope.loadServerModel();
                }
                objLoaderModal.modal('hide');
            });

            scope.$watch('selectedModel', function (newValue, oldValue, scope) {
                validateLoadButton();
            }, true);

            objLoaderModal.find('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
                let newTab = $(e.target).attr("href"); // activated tab
                isSelectedLocal = newTab === "#localTab";
                validateLoadButton();
            });

        },
        templateUrl: "app/components/html/fileLoaderModal.html"
    }
});