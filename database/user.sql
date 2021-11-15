/*
 Navicat Premium Data Transfer

 Source Server         : localhost
 Source Server Type    : MySQL
 Source Server Version : 80027
 Source Host           : localhost:3306
 Source Schema         : poker

 Target Server Type    : MySQL
 Target Server Version : 80027
 File Encoding         : 65001

 Date: 15/11/2021 09:06:23
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for user
-- ----------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `nickName` char(25) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `password` char(25) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `account` char(25) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of user
-- ----------------------------
INSERT INTO `user` VALUES (1, 'admin', 'admin', 'admin', '2021-10-27 15:15:33', '2021-10-27 15:15:28');
INSERT INTO `user` VALUES (2, 'guest', 'guest', 'guest', '2021-10-27 15:20:32', '2021-10-27 15:20:34');
INSERT INTO `user` VALUES (3, '匠心', 'jxpoker567788', '5711110@qq.com', '2021-11-15 09:05:39', '2021-11-15 09:05:45');

-- ----------------------------
-- Triggers structure for table user
-- ----------------------------
DROP TRIGGER IF EXISTS `update_user_time`;
delimiter ;;
CREATE TRIGGER `update_user_time` BEFORE UPDATE ON `user` FOR EACH ROW SET NEW.`UPDATE_TIME` = NOW()
;;
delimiter ;

SET FOREIGN_KEY_CHECKS = 1;
