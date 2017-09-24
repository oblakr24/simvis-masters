/**
 * Created by rokoblak on 7/17/17.
 */

app.directive('toolbar', function() {
    return {
        restrict: 'E',
        replace: true,
        scope: false,
        link: function (scope, element, attributes) {

            // Do not close on sub-dropdown click
            $('.dropdown-submenu-anchor').bind('click', function (e) {
                e.stopPropagation()
            });

            // Initialize fading
            $(".hover-div").stop().fadeTo("slow", 0.5);

            $(".hover-div").hover(function(){
                $(this).stop().fadeTo( "fast" , 1.0);
            }, function(){
                $(this).stop().fadeTo( "fast" , 0.5);
            });
        },
        templateUrl: function(element, attributes) {
            return 'app/components/html/toolbar.html';
        }
    };
});