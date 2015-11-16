module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),

		htmlmin: {
			options: {
				removeComments: true,
				collapseWhitespace: true
			},

			dist: {
				files: {
					"dist/scrap.html": "html/scrap.html"
				}
			}
		},

		cssmin: {
			dist: {
				files: {
					"dist/scrap.min.css": "css/scrap.css"
				}
			}
		},

	//	uglify: {
	//		dist: {
	//			files: {
	//				"dist/scrap.min.js": "js/scrap.js"
	//			}
	//		}
	//	},

		copy: {
			dist: {
				files: [
					{src: "js/bootstrap.min.js", dest: "dist/bootstrap.min.js"},
					{src: "js/verge.min.js", dest: "dist/verge.min.js"},
					{src: "js/jquery.min.js", dest: "dist/jquery.min.js"},
					{src: "css/bootstrap.min.css", dest: "dist/bootstrap.min.css"},
					{src: "js/scrap.js", dest: "dist/scrap.min.js"}
				]
			}
		},

		watch: {
			scripts: {
				files: ["html/*", "css/*", "js/*", "Gruntfile.js"],
				tasks: ["default"]
			}
		}
	});

	grunt.loadNpmTasks("grunt-contrib-htmlmin");
	grunt.loadNpmTasks("grunt-contrib-cssmin");
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-contrib-copy");
	grunt.loadNpmTasks("grunt-contrib-watch");
	grunt.registerTask("default", ["htmlmin", "cssmin", /*"uglify",*/ "copy"]);
	grunt.registerTask("do-watch", ["watch"]);
};
