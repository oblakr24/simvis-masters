/**
 * Created by rokoblak on 7/19/17.
 */


app.directive('loadingBar', function() {
    return {
        restrict: 'E',
        replace: true,
        scope: false,
        link: function (scope, element, attributes) {
            // Initialize fading
            $(".hover-div").stop().fadeTo("slow", 0.5);

            $(".hover-div").hover(function(){
                $(this).stop().fadeTo( "fast" , 1.0);
            }, function(){
                $(this).stop().fadeTo( "fast" , 0.5);
            });
        },
        templateUrl: function(element, attributes) {
            return 'app/components/html/loadingBar.html';
        }
    };
});