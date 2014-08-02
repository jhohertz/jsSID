"use strict";

module.exports = function(grunt) {
  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks("grunt-contrib-uglify");
  grunt.loadNpmTasks("grunt-contrib-clean");
  grunt.loadNpmTasks("grunt-contrib-watch");

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    jshint: {
      all: [ "js/jssid.*.js" ],
      options: {
        curly   : true,
        eqeqeq  : true,
        latedef : true,
        noarg   : true,
        noempty : true,
        quotmark: "double",
        undef   : true,
        strict  : true,
        trailing: true,
        newcap  : false,
        browser : true,
        node    : true
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
        sourceMap: "js/jssid.js.map"
      },
      files: {
        "js/jssid.js": [
          "js/jsxcompressor.js",
          "js/stream.js",
          "js/jssid.core.js",
          "js/jssid.tinysid.js",
          "js/jssid.fastsid.js",
          "js/jssid.resid.js",
          "js/jssid.mos6510.js",
          "js/jssid.sidplayer.js",
          "js/jssid.dmpplayer.js",
          "js/pico.dev.js"
        ]
      }
      //build: {
      //  src: 'src/<%= pkg.name %>.js',
      //  dest: 'build/<%= pkg.name %>.min.js'
      //}
    },
    watch: {
      src: {
        files: [ "js/jssid.*.js" ],
        tasks: [ "default" ]
      }
    },
    clean: [ "js/jssid.js", "js/jssid.js.map" ]
  });

  // Default task(s).
  grunt.registerTask('default', [ 'jshint', 'uglify']);
}

